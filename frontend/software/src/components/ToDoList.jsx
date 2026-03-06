"use client";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Checkbox } from "@/components/ui/checkbox";
import { Card } from "@/components/ui/card";
import { Calendar } from "@/components/ui/calendar";
import { Button } from "@/components/ui/button";
import { CalendarDays } from "lucide-react";
import { useState } from "react";
import {format} from "date-fns"
import {
  Popover,
  PopoverContent,
  PopoverDescription,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from "@/components/ui/popover";
const ToDoList = () => {
  const TodoListItem = [
    {
      desc: "Lorem8",
    },
    {
      desc: "Lorem8",
    },
    {
      desc: "Lorem8",
    },
  ];
  const [date, setDate] = useState(new Date());
  const [open, setOpen] = useState(false);
  return (
    <div className="">
      <h1 className="text-lg font-medium mb-6">Todo List</h1>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button variant="outline" className="w-full flex-1">
            {date ? format(date, "PPP") : <span>Pick A Date</span>}
            <CalendarDays />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="p-0 w-auto">
          <Calendar
            mode="single"
            selected={date}
            onSelect={(date)=> {
                setDate(date)
                setOpen(false)
            }}
            className=""
          />
        </PopoverContent>
      </Popover>
      {/* LIST  */}
      <ScrollArea className="max-h-100 mt-4 overflow-y-auto">
        {/* LIST ITEM  */}
        <div className="flex flex-col gap-2">
          {TodoListItem.map((item, index) => (
            <Card className="p-4" key={index}>
              <div className="flex items-center gap-4">
                <Checkbox id="item-1" checked />
                <label
                  htmlFor="item-1"
                  className="text-sm text-muted-foreground"
                >
                  {item.desc}
                </label>
              </div>
            </Card>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
};

export default ToDoList;
