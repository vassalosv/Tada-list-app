package app.tada.tasks;

import java.net.URI;

/** Only trusted HTTPS origins are accepted; credentials are never sent over HTTP. */
public final class ServerAddress {
    private ServerAddress() {}
    public static String normalize(String input) {
        try {
            URI uri = new URI(input.trim());
            if (!"https".equalsIgnoreCase(uri.getScheme()) || uri.getHost() == null ||
                uri.getRawUserInfo() != null || uri.getRawQuery() != null || uri.getRawFragment() != null ||
                !(uri.getRawPath() == null || uri.getRawPath().isEmpty() || "/".equals(uri.getRawPath())) ||
                uri.getPort() == 0 || uri.getPort() > 65535) throw new IllegalArgumentException();
            return "https://" + uri.getRawAuthority().toLowerCase(java.util.Locale.ROOT);
        } catch (Exception ex) {
            throw new IllegalArgumentException("Enter only the HTTPS server address, without a path, password or query.");
        }
    }
}
