package app.tada.tasks;
import org.junit.Test;
import static org.junit.Assert.*;

public class NativeNotificationPolicyTest {
    @Test public void scheduledAlarmsSuppressOnlyTheirMatchingInboxEvent() {
        assertTrue(NativeNotificationPolicy.matches("task", "Reminder: Test", 100000, "task", 100000));
        assertTrue(NativeNotificationPolicy.matches("task", "Coming up: Test", 110000, "task", 100000));
        assertFalse(NativeNotificationPolicy.matches("other", "Reminder: Test", 100000, "task", 100000));
        assertFalse(NativeNotificationPolicy.matches("task", "Reminder: Test", 200001, "task", 100000));
        assertFalse(NativeNotificationPolicy.matches("", "Test notification", 100000, "", 100000));
        assertFalse(NativeNotificationPolicy.matches("task", "Overdue: Test", 100000, "task", 100000));
    }
}
