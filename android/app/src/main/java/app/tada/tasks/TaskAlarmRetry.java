package app.tada.tasks;
import android.content.Context;
import androidx.annotation.NonNull;
import androidx.work.*;
public class TaskAlarmRetry extends Worker {
    public TaskAlarmRetry(@NonNull Context context,@NonNull WorkerParameters parameters){super(context,parameters);}
    @NonNull @Override public Result doWork(){return TaskAlarms.deliver(getApplicationContext(),getInputData().getInt("id",-1))?Result.success():Result.retry();}
}
