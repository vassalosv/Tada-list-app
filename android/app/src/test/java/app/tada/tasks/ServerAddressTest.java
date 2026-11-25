package app.tada.tasks;
import org.junit.Test;
import static org.junit.Assert.*;
public class ServerAddressTest {
 @Test public void acceptsSecureOrigins(){assertEquals("https://tada-list.duckdns.org",ServerAddress.normalize(" https://tada-list.duckdns.org/ "));assertEquals("https://example.com:8443",ServerAddress.normalize("https://example.com:8443"));}
 @Test public void rejectsUnsafeOrAmbiguousAddresses(){for(String value:new String[]{"http://example.com","example.com","https://user:pass@example.com","https://example.com/api","https://example.com?token=secret","https://example.com#fragment","https://example.com:99999","https://example.com:0","javascript:alert(1)","https://"}){try{ServerAddress.normalize(value);fail(value);}catch(IllegalArgumentException expected){}}}
}
