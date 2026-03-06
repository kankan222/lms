import Navbar from "../components/Navbar"
import AppSidebar from "../components/AppSidebar"


import { SidebarProvider } from "@/components/ui/sidebar"
import { Separator } from "@/components/ui/separator"
import { Outlet } from "react-router-dom"

const Layout = () => {
  const cookie = document.cookie.split('; ').find(row => row.startsWith('sidebar_state='));
  const defaultOpen = cookie ? cookie.split('=')[1] === 'true' : true; 
  return (
    <>
      <SidebarProvider defaultOpen={defaultOpen}>
        <AppSidebar />
      <main className="w-full">
        <Navbar />
        <Separator
            orientation=""
            className="mr-2 data-[orientation=]:h-4"
          />
        <div className="p-2 lg:p-4 xl:px-4 py-2">
          <Outlet />
        </div>
      </main>
      </SidebarProvider>
    </>
  )
}

export default Layout
