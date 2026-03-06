import DataTable from "../components/DataTable"
import ButtonGroup from "../components/ButtonGroup";
import TopBar from "../components/TopBar";
const columns = [
  { header: "ID", accessor: "name" },
  { header: "Photo", accessor: "name" },
  { header: "Student Name", accessor: "name" },
  { header: "Class", accessor: "dob" },
  { header: "Section", accessor: "gender" },
  { header: "Status", accessor: "status" },
];

const data = [
  { id: 1, name: "John Doe", email: "john@mail.com", role: "Admin", status: "active" },
  { id: 2, name: "Jane Smith", email: "jane@mail.com", role: "Editor", status: "primary" },
  { id: 3, name: "Alex Brown", email: "alex@mail.com", role: "User", status: "secondary" },
  { id: 4, name: "Mark Lee", email: "mark@mail.com", role: "User", status: "active" },
  { id: 5, name: "Sara Khan", email: "sara@mail.com", role: "Editor", status: "secondary" },
  { id: 1, name: "John Doe", email: "john@mail.com", role: "Admin", status: "active" },
  { id: 2, name: "Jane Smith", email: "jane@mail.com", role: "Editor", status: "primary" },
  { id: 3, name: "Alex Brown", email: "alex@mail.com", role: "User", status: "secondary" },
  { id: 4, name: "Mark Lee", email: "mark@mail.com", role: "User", status: "active" },
  { id: 5, name: "Sara Khan", email: "sara@mail.com", role: "Editor", status: "secondary" },
];

const Attendance = () => {
  const handleEdit = (row) => {
    console.log("Edit:", row);
  };

  const handleDelete = (row) => {
    console.log("Delete:", row);
  };
  return (
    <>
    <TopBar ButtonText="Add Attendance"/>
      <DataTable
      columns={columns}
      data={data}
      onEdit={handleEdit}
      onDelete={handleDelete}
       />
    </>
  )
}

export default Attendance
