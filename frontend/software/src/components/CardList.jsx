import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import Image from "/assets/logobg.png"
const LatestTransactions = [
    {
        id:1,
        title: "Subscription Renewal",
        badge: "Michael Johnson",
        image : Image,
        count: 1300
    },
    {
        id:2,
        title: "Payment for Services",
        badge: "Lily Adams",
        image : Image,
        count: 2500
    },

]
const PopularContent = [
    {
        
        id: 1,
        title: "Javascript ",
        badge: "Coding",
        image : Image,
        count: 1300
    },
    {
        id:2,
        title: "Information Technology",
        badge: "Tech",
        image : Image,
        count: 2500 
    }
]
const CardList = ({title}) => {

    const list = title === "Popular Content" ? PopularContent : LatestTransactions;
  return (
    <div>
      <h1 className="text-lg font-medium mb-6">{title}</h1>
      <div className="flex flex-col gap-2">
        {list.map(item => (
            <Card key={item.id} className="flex-row item-center justify-between gap-4 p-4">
                <div className="w-12 h-12 rounded-sm relative overflow-hidden">
                    <img src={item.image} alt={item.title} fill className="object-fit"/>
                </div>
                <CardContent className= "p-0 flex-1">
                    <CardTitle className="text-sm font-medium">{item.title}</CardTitle>
                    <Badge variant="secondary">{item.badge}</Badge>
                </CardContent>
                    <CardFooter className="p-0">{item.count / 1000}k</CardFooter>
            </Card>
        ))}
      </div>
    </div>
  )
}

export default CardList
