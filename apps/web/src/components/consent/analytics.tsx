'use client';

import { usePathname } from 'next/navigation';
import Script from 'next/script';
import { useEffect } from 'react';

import { channelForPath, isPrivatePath } from '@/lib/tracking';

import { useConsent } from './consent-provider';

const GA_ID = process.env.NEXT_PUBLIC_GA4_MEASUREMENT_ID;
const PIXEL_ID = process.env.NEXT_PUBLIC_META_PIXEL_ID;

type Gtag = (...args: unknown[]) => void;
type Fbq = (...args: unknown[]) => void;
type TrackingWindow = Window & Record<string, unknown> & { gtag?: Gtag; fbq?: Fbq };

/**
 * GA4 y Meta Pixel se cargan solo con consentimiento y si sus IDs están configurados.
 * Google Consent Mode v2: todo denegado por defecto y se actualiza con la elección.
 *
 * Las vistas de página se envían a mano y solo en rutas públicas: en el creador, la cuenta
 * y el acceso no sale ningún hit (ahí hay datos y fotos del niño). Para eso GA se configura
 * sin page_view automático y con su bloqueo oficial, y Meta sin seguimiento del historial.
 */
export function Analytics() {
  const { choice } = useConsent();
  const pathname = usePathname();
  const analytics = Boolean(GA_ID && choice?.analytics);
  const marketing = Boolean(PIXEL_ID && choice?.marketing);
  const privatePath = isPrivatePath(pathname);

  useEffect(() => {
    const win = window as unknown as TrackingWindow;
    if (GA_ID) win[`ga-disable-${GA_ID}`] = privatePath;
    if (privatePath) return;
    // Solo origen + ruta: sin parámetros de búsqueda ni fragmentos.
    // Marca compartida con los scripts de abajo para no repetir ni perder la primera vista.
    const location = `${window.location.origin}${pathname}`;
    if (analytics && win.gtag && win.__snGaPage !== pathname) {
      win.__snGaPage = pathname;
      win.gtag('event', 'page_view', {
        page_location: location,
        content_group: channelForPath(pathname),
      });
    }
    if (marketing && win.fbq && win.__snFbPage !== pathname) {
      win.__snFbPage = pathname;
      win.fbq('track', 'PageView');
    }
  }, [pathname, privatePath, analytics, marketing]);

  // Eventos del embudo público: cualquier elemento con data-track="evento" (y data-track-*
  // como parámetros). Nunca datos del niño: solo público, historia, filtro o línea.
  useEffect(() => {
    if (!analytics || privatePath) return;
    const onClick = (event: MouseEvent) => {
      const gtag = (window as unknown as TrackingWindow).gtag;
      if (!gtag) return;
      const element = event.target as Element | null;
      // Cualquier enlace al creador cuenta como "empezó", con su línea.
      const create = element?.closest<HTMLAnchorElement>(
        'a[href*="/crear"], a[href*="/create"], a[href*="/criar"]',
      );
      if (create) {
        const line = new URL(create.href).searchParams.get('line') ?? 'families';
        gtag('event', 'create_started', { line });
        return;
      }
      const target = element?.closest<HTMLElement>('[data-track]');
      if (!target) return;
      const params: Record<string, string> = {};
      for (const [key, value] of Object.entries(target.dataset)) {
        if (key.startsWith('track') && key !== 'track' && value) {
          params[key.slice(5).toLowerCase()] = value;
        }
      }
      gtag('event', target.dataset.track, params);
    };
    document.addEventListener('click', onClick, { capture: true });
    return () => {
      document.removeEventListener('click', onClick, { capture: true });
    };
  }, [analytics, privatePath]);

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
window['ga-disable-${GA_ID}']=${String(privatePath)};
gtag('js',new Date());gtag('config','${GA_ID}',{send_page_view:false});
if(!${String(privatePath)}&&window.__snGaPage!==location.pathname){window.__snGaPage=location.pathname;gtag('event','page_view',{page_location:location.origin+location.pathname});}`}
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
fbq.disablePushState=true;fbq('init','${PIXEL_ID}');
if(!${String(privatePath)}&&window.__snFbPage!==location.pathname){window.__snFbPage=location.pathname;fbq('track','PageView');}`}
        </Script>
      )}
    </>
  );
}
