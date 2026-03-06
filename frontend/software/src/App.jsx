import AppRoutes from "./routes/AppRoutes"
import { ThemeProvider } from "./components/providers/ThemeProvider"
import {TooltipProvider} from "@/components/ui/tooltip"

const App = () => {
  return (
    <>
    
      <ThemeProvider defaultTheme="system" storageKey="vite-ui-theme">
        <TooltipProvider>
          <AppRoutes />
        </TooltipProvider>
      </ThemeProvider>
    </>
  )
}

export default App
