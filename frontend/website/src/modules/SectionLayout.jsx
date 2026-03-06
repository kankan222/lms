import { Outlet } from "react-router-dom";

const SectionLayout = ({config}) => {
  return (
    <> 
      
      <Outlet context={config}/>
    </>  )}

    export default SectionLayout