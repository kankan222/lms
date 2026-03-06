import { columns } from "./columns"
import { DataTable } from "./data-table"

async function getData() {
  // Fetch data from API here
  return [
    {
      id: "728ed52f",
      amount: 100,
      status: "pending",
      email: "m@example.com",
    },
  ]
}

export default async function UsersPage(){
    const data = await getData()
  return (
    <div>
      <DataTable columns={columns} data={data} />
    </div>
  )
}



