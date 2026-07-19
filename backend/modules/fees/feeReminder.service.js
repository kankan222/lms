export async function runFeeReminder(){
  console.warn(
    "Fee reminder job is disabled: the legacy implementation targeted student IDs instead of user IDs and no current overdue-invoice repository is available."
  );
  return 0;
}
