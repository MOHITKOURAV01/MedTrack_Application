package com.medtrack.architecture;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.io.IOException;
import java.io.UncheckedIOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.stream.Collectors;
import java.util.stream.Stream;

import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * Fails when two controller handlers claim the same HTTP method and path.
 *
 * <p>Spring MVC detects this itself, but only at context refresh:</p>
 *
 * <pre>
 * IllegalStateException: Ambiguous mapping. Cannot map 'vulnerabilityManagementController'
 * method ...VulnerabilityManagementController#getActivePolicy()
 * to { GET [/api/auth/vulnerability/policy] }: There is already 'securityVulnerabilityController'
 * bean method ...SecurityVulnerabilityController#getActivePolicy() mapped.
 * </pre>
 *
 * <p>That failure takes down the entire application, not just the offending module, and it is only
 * observed by someone who actually boots the app. {@code SecurityVulnerabilityController} and
 * {@code VulnerabilityManagementController} both declared {@code GET} and {@code PUT} on
 * {@code /api/auth/vulnerability/policy} and the collision went unnoticed through review.</p>
 *
 * <p>This test reads the annotations as source text rather than booting a context, so it stays fast
 * and keeps working when the module does not compile — the situation in which an ambiguous mapping
 * is most likely to be introduced and least likely to be caught.</p>
 *
 * <p>Two controllers sharing a base path is fine and is not reported; only an exact
 * method-plus-path collision is.</p>
 */
@DisplayName("controller request mappings")
class RequestMappingUniquenessTest {

    private static final Pattern CLASS_REQUEST_MAPPING = Pattern.compile(
            "@RequestMapping\\s*\\(\\s*(?:value\\s*=\\s*)?\"([^\"]*)\"");

    private static final Pattern METHOD_MAPPING = Pattern.compile(
            "@(Get|Post|Put|Delete|Patch)Mapping\\s*(?:\\(\\s*(?:value\\s*=\\s*)?\"([^\"]*)\")?");

    @Test
    @DisplayName("no two handlers map the same method and path")
    void noAmbiguousMappings() {
        Map<String, List<String>> routeOwners = new LinkedHashMap<>();

        for (Path controller : controllerSources()) {
            String source = stripComments(read(controller));
            String basePath = basePath(source);
            String controllerName = controller.getFileName().toString().replace(".java", "");

            for (String route : routesIn(source, basePath)) {
                routeOwners.computeIfAbsent(route, key -> new ArrayList<>()).add(controllerName);
            }
        }

        List<String> collisions = routeOwners.entrySet().stream()
                .filter(entry -> entry.getValue().size() > 1)
                .map(entry -> "  %s%n      claimed by: %s"
                        .formatted(entry.getKey(), String.join(", ", entry.getValue())))
                .collect(Collectors.toList());

        assertTrue(collisions.isEmpty(), () -> """
                %d route(s) are mapped by more than one handler.

                Spring MVC throws IllegalStateException: Ambiguous mapping at context refresh, which
                prevents the entire application from starting - not only the affected module.

                %s""".formatted(collisions.size(), String.join("\n", collisions)));
    }

    @Test
    @DisplayName("the scan actually found the controllers")
    void controllersWereFound() {
        List<Path> controllers = controllerSources();
        assertTrue(controllers.size() > 20, () ->
                "Only found " + controllers.size() + " controller(s) under " + mainJavaRoot()
                        + ". A path or naming change would make the collision check vacuous.");
    }

    // ---------------------------------------------------------------------
    // parsing
    // ---------------------------------------------------------------------

    /**
     * Expands one source file into the set of {@code METHOD /path} routes it declares.
     *
     * <p>A single annotation may declare several paths ({@code @GetMapping({"/a", "/b"})}) and
     * several methods ({@code @RequestMapping(method = {GET, POST})}); only the common single-value
     * forms actually used in this codebase are parsed, and anything unrecognised is skipped rather
     * than guessed at, so this test never reports a collision that is not real.</p>
     */
    private static Set<String> routesIn(String source, String basePath) {
        Set<String> routes = new LinkedHashSet<>();
        Matcher matcher = METHOD_MAPPING.matcher(source);

        while (matcher.find()) {
            String httpMethod = matcher.group(1).toUpperCase(Locale.ROOT);
            String path = matcher.group(2) == null ? "" : matcher.group(2);
            routes.add(httpMethod + " " + normalise(basePath + path));
        }

        return routes;
    }

    private static String basePath(String source) {
        Matcher matcher = CLASS_REQUEST_MAPPING.matcher(source);
        return matcher.find() ? matcher.group(1) : "";
    }

    /**
     * Normalises a path for comparison: collapses duplicate slashes, drops a trailing slash, and
     * rewrites path variables to a placeholder so {@code /{id}} and {@code /{equipmentId}} are
     * recognised as the same route — which is exactly how Spring treats them.
     */
    private static String normalise(String path) {
        String normalised = path.replaceAll("/{2,}", "/");
        normalised = normalised.replaceAll("\\{[^}]*}", "{}");
        if (normalised.length() > 1 && normalised.endsWith("/")) {
            normalised = normalised.substring(0, normalised.length() - 1);
        }
        return normalised.isEmpty() ? "/" : normalised;
    }

    /**
     * Removes comments while leaving string literals intact.
     *
     * <p>A regex-based stripper is not sufficient here, and the failure is subtle. Ant-style path
     * patterns such as {@code "/swagger-ui/**"} and {@code "/api/equipment/**"} contain the
     * character sequence that <em>opens</em> a block comment. A naive
     * regex-based block-comment strip treats the one inside the string literal as the start of a
     * comment and swallows everything up to the next block-comment terminator — silently emptying
     * the parse rather than failing loudly.</p>
     *
     * <p>Scanning character by character with string-literal awareness is the only reliable
     * approach. The "did the scan find anything" assertions in this class exist because exactly
     * this mistake was made while writing it.</p>
     */
    private static String stripComments(String source) {
        StringBuilder out = new StringBuilder(source.length());
        int index = 0;
        int length = source.length();

        while (index < length) {
            char current = source.charAt(index);

            if (current == '"') {
                int end = index + 1;
                while (end < length) {
                    if (source.charAt(end) == '\\') {
                        end += 2;
                        continue;
                    }
                    if (source.charAt(end) == '"') {
                        break;
                    }
                    end++;
                }
                out.append(source, index, Math.min(end + 1, length));
                index = end + 1;
                continue;
            }

            if (current == '/' && index + 1 < length && source.charAt(index + 1) == '/') {
                while (index < length && source.charAt(index) != '\n') {
                    index++;
                }
                continue;
            }

            if (current == '/' && index + 1 < length && source.charAt(index + 1) == '*') {
                int end = source.indexOf("*/", index + 2);
                index = end < 0 ? length : end + 2;
                continue;
            }

            out.append(current);
            index++;
        }

        return out.toString();
    }

    private static List<Path> controllerSources() {
        Path root = mainJavaRoot();
        try (Stream<Path> paths = Files.walk(root)) {
            return paths.filter(Files::isRegularFile)
                    .filter(path -> path.getFileName().toString().endsWith("Controller.java"))
                    .sorted()
                    .collect(Collectors.toList());
        } catch (IOException e) {
            throw new UncheckedIOException("Unable to walk the backend source tree at " + root, e);
        }
    }

    private static Path mainJavaRoot() {
        Path fromModule = Paths.get("src", "main", "java").toAbsolutePath().normalize();
        if (Files.isDirectory(fromModule)) {
            return fromModule;
        }
        Path fromRepositoryRoot = Paths.get("Backend", "src", "main", "java")
                .toAbsolutePath()
                .normalize();
        if (Files.isDirectory(fromRepositoryRoot)) {
            return fromRepositoryRoot;
        }
        throw new IllegalStateException(
                "Could not locate src/main/java from working directory "
                        + Paths.get("").toAbsolutePath());
    }

    private static String read(Path source) {
        try {
            return Files.readString(source, StandardCharsets.UTF_8);
        } catch (IOException e) {
            throw new UncheckedIOException("Unable to read " + source, e);
        }
    }
}
