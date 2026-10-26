'use client';

import Script from 'next/script';
import { useEffect } from 'react';

import { useConsent } from './consent-provider';

const GA_ID = process.env.NEXT_PUBLIC_GA4_MEASUREMENT_ID;
const PIXEL_ID = process.env.NEXT_PUBLIC_META_PIXEL_ID;

type Gtag = (...args: unknown[]) => void;

/**
 * GA4 y Meta Pixel se cargan solo con consentimiento y si sus IDs están configurados.
 * Google Consent Mode v2: todo denegado por defecto y se actualiza con la elección.
 */
export function Analytics() {
  const { choice } = useConsent();
  const analytics = Boolean(GA_ID && choice?.analytics);
  const marketing = Boolean(PIXEL_ID && choice?.marketing);

  useEffect(() => {
    const gtag = (window as unknown as { gtag?: Gtag }).gtag;
    gtag?.('consent', 'update', {
      analytics_storage: choice?.analytics ? 'granted' : 'denied',
      ad_storage: choice?.marketing ? 'granted' : 'denied',
      ad_user_data: choice?.marketing ? 'granted' : 'denied',
      ad_personalization: choice?.marketing ? 'granted' : 'denied',
    });
  }, [choice]);

  return (
    <>
      {analytics && GA_ID && (
        <>
          <Script id="ga-consent" strategy="afterInteractive">
            {`window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}window.gtag=gtag;
gtag('consent','default',{analytics_storage:'denied',ad_storage:'denied',ad_user_data:'denied',ad_personalization:'denied'});
gtag('consent','update',{analytics_storage:'granted',ad_storage:'${choice?.marketing ? 'granted' : 'denied'}',ad_user_data:'${choice?.marketing ? 'granted' : 'denied'}',ad_personalization:'${choice?.marketing ? 'granted' : 'denied'}'});
gtag('js',new Date());gtag('config','${GA_ID}');`}
          </Script>
          <Script
            src={`https://www.googletagmanager.com/gtag/js?id=${GA_ID}`}
            strategy="afterInteractive"
          />
        </>
      )}
      {marketing && PIXEL_ID && (
        <Script id="meta-pixel" strategy="afterInteractive">
          {`!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};
if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;
t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');
fbq('init','${PIXEL_ID}');fbq('track','PageView');`}
        </Script>
      )}
    </>
  );
}
