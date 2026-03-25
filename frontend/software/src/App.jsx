import AppRoutes from "./routes/AppRoutes"
import { ThemeProvider } from "./components/providers/ThemeProvider"
import {TooltipProvider} from "@/components/ui/tooltip"
import NotificationProvider from "./notifications/NotificationProvider"

const App = () => {
  return (
    <>
    
      <ThemeProvider defaultTheme="system" storageKey="vite-ui-theme">
        <TooltipProvider>
          <NotificationProvider>
            <AppRoutes />
          </NotificationProvider>
        </TooltipProvider>
      </ThemeProvider>
    </>
  )
}

export default App
