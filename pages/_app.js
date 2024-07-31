import dynamic from 'next/dynamic'
import { Analytics } from "@vercel/analytics/react"

const DynamicHome = dynamic(() => import('./index'), { ssr: false })

function MyApp({ Component, pageProps }) {
  return (
  <>
  <Analytics />
  <DynamicHome {...pageProps} />
  </>
  )

}

export default MyApp