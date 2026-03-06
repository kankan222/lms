import * as service from "./reports.service.js"
import { generateReportPdf } from "./reportPdf.service.js";

export async function getReport(req,res,next){
  try{

    const result =
      await service.generateReport({
        studentId:req.params.studentId,
        examId:req.params.examId
      });

    res.json({ success:true,data:result });

  }catch(err){ next(err); }
}

export async function downloadReport(req,res,next){
  try{

    const pdf =
      await generateReportPdf({
        studentId:req.params.studentId,
        examId:req.params.examId
      });

    res.set({
      "Content-Type":"application/pdf",
      "Content-Disposition":
        "attachment; filename=report-card.pdf"
    });

    res.send(pdf);

  }catch(err){
    next(err);
  }
}