

const TopBar = ({title, subTitle, action}) => {
  return (
    <div className="flex items-center justify-between mb-3">
          <div>
            <p className="text-3xl font-bold">{title}</p>
            <p className="text-xs text-gray-500">{subTitle}</p>
          </div>
        {action}
    </div>
  )
}

export default TopBar
