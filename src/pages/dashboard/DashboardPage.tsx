import React, { useEffect, useState } from 'react'
import FadeSlideUp from '../../components/FadeSlideUp'
import { Admin } from '../../interfaces/Admin'
import { getAdminUserData, hasAdminUserData } from '../../services/user-storage'
import { useNavigate } from 'react-router'
import { Bar, Line, Pie } from 'react-chartjs-2'
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend, ArcElement, PointElement, LineElement, Filler } from 'chart.js'
import Calendar from 'react-calendar'
import 'react-calendar/dist/Calendar.css'
import { Book1, People, Personalcard } from 'iconsax-react'

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend, ArcElement, PointElement, LineElement, Filler)

export default function DashboardPage() {
  const [admin, setAdmin] = useState<Admin | null>(null)
  const navigate = useNavigate()

  useEffect(() => {
    if (hasAdminUserData()) {
      setAdmin(getAdminUserData())
      return
    }
    navigate('../login', { replace: true })
  }, [])

  if (!admin) {
    return <p></p>
  }

  const barData = {
    labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
    datasets: [
      {
        label: 'Student Enrollment',
        data: [65, 59, 80, 81, 56, 55, 40, 30, 20, 10, 5, 1],
        backgroundColor: 'rgba(75, 192, 192, 0.2)',
        borderColor: 'rgba(75, 192, 192, 1)',
        borderWidth: 1,
      },
    ],
  }

  const lineData = {
    labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
    datasets: [
      {
        label: 'Performance',
        data: [65, 59, 80, 81, 56, 55, 40, 30, 20, 10, 40, 1],
        fill: true,
        backgroundColor: 'rgba(76, 175, 80, 0.2)',
        borderColor: 'rgba(76, 175, 80, 1)',
        tension: 0.3,
      },
    ],
  }

  const pieData = {
    labels: ['Red', 'Blue', 'Yellow'],
    datasets: [
      {
        label: '# of Votes',
        data: [12, 19, 3],
        backgroundColor: ['rgba(255, 99, 132, 0.2)', 'rgba(54, 162, 235, 0.2)', 'rgba(255, 206, 86, 0.2)'],
        borderColor: ['rgba(255, 99, 132, 1)', 'rgba(54, 162, 235, 1)', 'rgba(255, 206, 86, 1)'],
        borderWidth: 1,
      },
    ],
  }



  const calendarTileClassName = ({ date, view }: { date: Date; view: string }) => {
    if (view === 'month') {
      return 'text-black '
    }
  }

  return (
    <div className='text-white bg-transparent px-6 py-8 w-full h-fit overflow-x-hidden overflow-y-scroll scholarly-scrollbar'>
      <FadeSlideUp className='select-none font-light text-4xl'>
        Welcome, {admin?.role.charAt(0).toUpperCase() + admin?.role.substring(1)}{' '}
        <span className='font-extrabold'>{admin?.fullName}</span>
      </FadeSlideUp>

      
      <div className='grid grid-cols-4 gap-4 mb-4 py-3'>
      <div className='bg-tertiary text-white p-4 rounded-lg shadow-md flex gap-2'>
        <People size="32" color="#560677" />
          <h3 className='text-lg font-bold '>Total Students <span className='border-l border-white pl-2 text-2xl ml-1'>75</span></h3>
        </div>

        <div className='bg-tertiary text-white p-4 rounded-lg shadow-md flex gap-2'>
        <Personalcard size="32" color="#560677"/>
          <h3 className='text-lg font-bold'>Total Teachers <span className='border-l border-white pl-2 text-2xl ml-1'>50</span></h3>
        </div>

        <div className='bg-tertiary text-white p-4 rounded-lg shadow-md flex gap-2'>
        <Book1 size="32" color="#560677"/>
          <h3 className='text-lg font-bold'>Total Courses <span className='border-l border-white pl-2 text-2xl ml-1'>130</span> </h3>
        </div>

        

      </div>
      

      <div className='grid grid-cols-1 md:grid-cols-2 gap-4 mt-8'>
        <div className='bg-tertiary text-secondary max-h-[400px] p-4 rounded-lg shadow-md '>
          <h2 className='text-2xl font-bold mb-4 text-white'>Student Enrollment</h2>
          <Bar data={barData} options={{ plugins: { legend: { display: false } } }} />
        </div>
        <div className='bg-tertiary p-4 max-h-[400px] rounded-lg shadow-md text-secondary'>
          <h2 className='text-2xl font-bold mb-4 text-white'>Performance Over Time</h2>
          <Line data={lineData} options={{ maintainAspectRatio: true, plugins: { legend: { display: false }, filler: { propagate: true }, colors: { forceOverride: true } }, scales: { x: { type: 'category' }, y: { type: 'linear', beginAtZero: true } } }} />
        </div>
        {/* <div className='bg-tertiary text-black p-1  rounded-lg shadow-md w-[400px]'>
          <h2 className='text-2xl font-bold mb-4 text-white'>Calendar</h2>
          <div className='custom-calendar '>
            <Calendar 
              className=''
              tileClassName={calendarTileClassName}
            />
          </div>
        </div> */}
        
      {/* <div className='grid grid-cols-2 gap-4 '>
         <div className='bg-tertiary p-4 max-h-[400px] rounded-lg shadow-md'>
          <h2 className='text-2xl font-bold mb-4 text-white'>Notice Board</h2>
        </div> 
        
        
  
      { <div className='bg-tertiary p-4 max-h-[400px] rounded-lg shadow-md'>
          <h2 className='text-2xl font-bold mb-4 text-white'>Recent Activities</h2>
      </div> }
      </div> */}
      
     
    </div>
    </div>
  )
}