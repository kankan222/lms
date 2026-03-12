import {useState, useEffect} from "react";
import { getAllTeacherAttendance } from "../api/teachers.api";
import { usePermissions } from "../hooks/usePermissions";

import DataTable from "../components/DataTable"

import TopBar from "../components/TopBar";
const columns = [
  { header: "Teacher", accessor: "teacher" },
  { header: "Date", accessor: "attendance_date" },
  { header: "Check In", accessor: "check_in" },
  { header: "Check Out", accessor: "check_out" },
  { header: "Status", accessor: "status" },
  { header: "Worked Hours", accessor: "worked_hours" },
];


const Attendance = () => {
  const { can } = usePermissions();
  const canManageTeachers = can("teacher.update");

  const [attendance, setAttendance] =useState([])

  useEffect(()=>{
    loadAttendance();
  }, [])


  async function loadAttendance() {
    const res = await getAllTeacherAttendance()
    setAttendance(res.data || [])
    console.log(res)
  }
  return (
    <>
    <TopBar
    title={canManageTeachers ? "Attendance" : "My Attendance"}
    subTitle={canManageTeachers ? "Manage all attendances here" : "View your own attendance records"}
    />
      <DataTable
      columns={columns}
      data={attendance}
       />
    </>
  )
}

export default Attendance
