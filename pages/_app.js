import dynamic from 'next/dynamic'

const DynamicHome = dynamic(() => import('./index'), { ssr: false })

function MyApp({ Component, pageProps }) {
  return <DynamicHome {...pageProps} />
}

export default MyApp