/** @jsxRuntime automatic @jsxImportSource react */
import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Link,
  Preview,
  Section,
  Text,
} from '@react-email/components';
import type { Locale } from '@storynido/shared';

import { COLORS, type EmailBrand } from './brand';
import type { EmailCopy, LocaleCopy } from './copy';

const serif = "Fraunces, Georgia, 'Times New Roman', serif";
const sans = "'Nunito Sans', 'Helvetica Neue', Arial, sans-serif";

/** Estructura común: marca, título, párrafos, un botón y el pie (con baja si es marketing). */
export function EmailLayout({
  locale,
  brand,
  copy,
  footer,
  unsubscribeUrl,
}: {
  locale: Locale;
  brand: EmailBrand;
  copy: EmailCopy;
  footer: LocaleCopy['footer'];
  unsubscribeUrl: string | null;
}) {
  return (
    <Html lang={locale}>
      <Head />
      <Preview>{copy.preview}</Preview>
      <Body
        style={{
          backgroundColor: COLORS.background,
          margin: 0,
          padding: '24px 0',
          fontFamily: sans,
        }}
      >
        <Container style={{ maxWidth: 560, margin: '0 auto', padding: '0 16px' }}>
          <Text
            style={{
              fontFamily: serif,
              fontSize: 22,
              fontWeight: 600,
              color: COLORS.primary,
              margin: '0 0 16px',
            }}
          >
            {brand.name}
          </Text>
          <Section
            style={{
              backgroundColor: COLORS.card,
              border: `1px solid ${COLORS.border}`,
              borderRadius: 20,
              padding: '28px 28px 24px',
            }}
          >
            <Heading
              as="h1"
              style={{
                fontFamily: serif,
                fontSize: 26,
                fontWeight: 500,
                lineHeight: '1.2',
                color: COLORS.ink,
                margin: '0 0 16px',
              }}
            >
              {copy.heading}
            </Heading>
            {copy.paragraphs.map((paragraph) => (
              <Text
                key={paragraph}
                style={{ fontSize: 16, lineHeight: '1.6', color: COLORS.ink, margin: '0 0 12px' }}
              >
                {paragraph}
              </Text>
            ))}
            {copy.cta && (
              <Button
                href={copy.cta.url}
                style={{
                  backgroundColor: COLORS.primary,
                  color: '#ffffff',
                  borderRadius: 999,
                  padding: '12px 22px',
                  fontSize: 15,
                  fontWeight: 600,
                  marginTop: 8,
                }}
              >
                {copy.cta.label}
              </Button>
            )}
          </Section>
          <Hr style={{ borderColor: COLORS.border, margin: '24px 0 12px' }} />
          <Text style={{ fontSize: 12, lineHeight: '1.5', color: COLORS.muted, margin: 0 }}>
            {unsubscribeUrl ? footer.marketing : footer.transactional} {footer.help}
          </Text>
          {unsubscribeUrl && (
            <Text style={{ fontSize: 12, color: COLORS.muted, margin: '6px 0 0' }}>
              <Link
                href={unsubscribeUrl}
                style={{ color: COLORS.muted, textDecoration: 'underline' }}
              >
                {footer.unsubscribe}
              </Link>
              {brand.postalAddress ? ` · ${brand.postalAddress}` : ''}
            </Text>
          )}
          <Text style={{ fontSize: 12, color: COLORS.muted, margin: '6px 0 0' }}>
            <Link href={brand.siteUrl} style={{ color: COLORS.muted }}>
              {brand.siteUrl.replace(/^https?:\/\//, '')}
            </Link>
          </Text>
        </Container>
      </Body>
    </Html>
  );
}
