import type { BookFormat, EmailTemplate, Locale } from '@storynido/shared';

import type { EmailData } from './data';

export interface EmailCopy {
  subject: string;
  /** Texto que muestran los clientes de correo junto al asunto. */
  preview: string;
  heading: string;
  paragraphs: string[];
  cta: { label: string; url: string } | null;
}

type TemplateCopy = { [T in EmailTemplate]: (data: EmailData<T>) => EmailCopy };

export interface LocaleCopy {
  templates: TemplateCopy;
  footer: {
    transactional: string;
    marketing: string;
    unsubscribe: string;
    help: string;
  };
}

const FORMATS: Record<Locale, Record<BookFormat, string>> = {
  es: {
    digital: 'digital (PDF)',
    softcover: 'impreso, tapa blanda',
    hardcover: 'impreso, tapa dura',
  },
  en: { digital: 'digital (PDF)', softcover: 'printed softcover', hardcover: 'printed hardcover' },
  pt: {
    digital: 'digital (PDF)',
    softcover: 'impresso, capa mole',
    hardcover: 'impresso, capa dura',
  },
};

const cta = (label: string, url: string) => ({ label, url });

const es: LocaleCopy = {
  templates: {
    welcome: (d) => ({
      subject: 'Bienvenida a StoryNido',
      preview: 'Tu cuenta está lista para crear cuentos con su protagonista favorito.',
      heading: d.name ? `¡Hola, ${d.name}!` : '¡Hola!',
      paragraphs: [
        'Tu cuenta está lista. Con StoryNido creas un cuento ilustrado donde tu peque es el protagonista: con su nombre, su carita y lo que más le gusta.',
        'La vista previa es gratis: ves la historia y las primeras ilustraciones antes de decidir.',
      ],
      cta: cta('Crear un cuento', d.url),
    }),
    preview_ready: (d) => ({
      subject: `La muestra de «${d.bookTitle}» está lista`,
      preview: `Mira cómo quedó ${d.childName} en su cuento.`,
      heading: 'Tu muestra está lista',
      paragraphs: [
        `Ya puedes ver la portada y las primeras páginas de «${d.bookTitle}», con ${d.childName} como protagonista.`,
        'Si te gusta, eliges el formato y lo creamos completo.',
      ],
      cta: cta('Ver la muestra', d.url),
    }),
    draft_reminder: (d) => ({
      subject: `El cuento de ${d.childName} te está esperando`,
      preview: 'Tu borrador quedó guardado: retómalo cuando quieras.',
      heading: `El cuento de ${d.childName} sigue guardado`,
      paragraphs: [
        'Dejaste un cuento a medio camino. Está guardado tal como lo dejaste: puedes retomarlo cuando quieras.',
      ],
      cta: cta('Seguir con el cuento', d.url),
    }),
    payment_confirmed: (d) => ({
      subject: `Recibimos tu pago: «${d.bookTitle}»`,
      preview: 'Empezamos a crear tu libro.',
      heading: '¡Gracias por tu compra!',
      paragraphs: [
        `Confirmamos el pago de «${d.bookTitle}» (${FORMATS.es[d.format]}). Total: ${d.total}.`,
        'Ya empezamos a crearlo: ilustramos cada página y la revisamos. Te avisamos por correo en cada paso.',
      ],
      cta: cta('Ver mi pedido', d.url),
    }),
    digital_ready: (d) => ({
      subject: `¡«${d.bookTitle}» está listo!`,
      preview: 'Ya puedes descargar tu libro.',
      heading: '¡Tu libro está listo!',
      paragraphs: [
        `Terminamos «${d.bookTitle}». Puedes descargarlo desde tu pedido cuando quieras: el enlace de descarga se genera en el momento, solo para tu cuenta.`,
      ],
      cta: cta('Descargar mi libro', d.url),
    }),
    print_sent: (d) => ({
      subject: `«${d.bookTitle}» ya está en la imprenta`,
      preview: 'Tu libro impreso está en camino a producción.',
      heading: 'Tu libro está en la imprenta',
      paragraphs: [
        `Terminamos «${d.bookTitle}» y lo enviamos a imprimir. El plazo estimado de producción y envío es de ${d.etaDaysMin} a ${d.etaDaysMax} días hábiles.`,
        'Mientras tanto, ya puedes descargar la versión digital desde tu pedido.',
      ],
      cta: cta('Ver mi pedido', d.url),
    }),
    print_in_production: (d) => ({
      subject: `Estamos imprimiendo «${d.bookTitle}»`,
      preview: 'Tu libro ya se está imprimiendo.',
      heading: 'Tu libro se está imprimiendo',
      paragraphs: [`La imprenta empezó a producir «${d.bookTitle}». Te avisamos cuando salga.`],
      cta: cta('Ver mi pedido', d.url),
    }),
    shipped: (d) => ({
      subject: `«${d.bookTitle}» va en camino`,
      preview: 'Tu libro salió de la imprenta.',
      heading: 'Tu libro va en camino',
      paragraphs: [
        `«${d.bookTitle}» salió de la imprenta.`,
        d.trackingNumber
          ? `Número de seguimiento: ${d.trackingNumber}.`
          : 'Te avisamos cuando tengamos el número de seguimiento.',
      ],
      cta: d.trackingUrl ? cta('Seguir el envío', d.trackingUrl) : cta('Ver mi pedido', d.url),
    }),
    delivered: (d) => ({
      subject: `«${d.bookTitle}» fue entregado`,
      preview: 'Esperamos que lo disfruten mucho.',
      heading: '¡Tu libro llegó!',
      paragraphs: [
        `«${d.bookTitle}» figura como entregado. Esperamos que lo disfruten juntos.`,
        'Si algo no llegó bien, responde a este correo y lo resolvemos.',
      ],
      cta: cta('Ver mi pedido', d.url),
    }),
    refunded: (d) => ({
      subject: `Reembolso de «${d.bookTitle}»`,
      preview: 'Procesamos tu reembolso.',
      heading: 'Procesamos tu reembolso',
      paragraphs: [
        `Reembolsamos ${d.total} por «${d.bookTitle}». Según tu banco, puede tardar unos días en verse en tu cuenta.`,
      ],
      cta: null,
    }),
    cancelled: (d) => ({
      subject: `Cancelamos el pedido de «${d.bookTitle}»`,
      preview: 'Tu pedido fue cancelado.',
      heading: 'Tu pedido fue cancelado',
      paragraphs: [
        `Cancelamos el pedido de «${d.bookTitle}». Si no lo pediste o tienes dudas, responde a este correo.`,
      ],
      cta: null,
    }),
    data_deleted: (d) => ({
      subject: 'Borramos tus datos',
      preview: 'Confirmación del borrado de datos.',
      heading: 'Borramos tus datos',
      paragraphs: [
        d.scope === 'account'
          ? 'Borramos tu cuenta, los perfiles, las fotos y los borradores. Los pedidos pagados se conservan solo para facturación.'
          : 'Borramos el perfil, las fotos y los borradores que pediste. Los libros ya pedidos se conservan.',
      ],
      cta: null,
    }),
    review_request: (d) => ({
      subject: `¿Qué les pareció «${d.bookTitle}»?`,
      preview: 'Tu opinión nos ayuda a mejorar.',
      heading: '¿Qué les pareció el libro?',
      paragraphs: [
        `Hace unos días recibiste «${d.bookTitle}». Nos encantaría saber qué les pareció: te lleva un minuto y nos ayuda mucho.`,
      ],
      cta: cta('Dejar mi opinión', d.url),
    }),
    new_book_suggestion: (d) => {
      const who = d.childName ? ` para ${d.childName}` : '';
      const occasion = d.occasion === 'christmas' ? 'Navidad' : 'el Día del Niño';
      return {
        subject: `Un cuento nuevo${who} para ${occasion}`,
        preview: `Se acerca ${occasion}: un regalo hecho a su medida.`,
        heading: `Se acerca ${occasion}`,
        paragraphs: [
          `¿Qué tal un cuento nuevo${who}? Elige otra aventura y crea la vista previa gratis.`,
        ],
        cta: cta('Crear un cuento', d.url),
      };
    },
    admin_alert: (d) => ({
      subject: `[StoryNido] ${d.kind}${d.orderId ? ` · pedido ${d.orderId}` : ''}`,
      preview: d.message,
      heading: 'Alerta para revisar',
      paragraphs: [d.message, d.orderId ? `Pedido: ${d.orderId}` : ''].filter(Boolean),
      cta: cta('Abrir en el admin', d.url),
    }),
    // Al equipo (siempre en español): "Responder" contesta a quien escribió.
    contact_message: (d) => ({
      subject: `[Contacto] ${d.topic} · ${d.name}`,
      preview: d.message.slice(0, 120),
      heading: 'Mensaje desde el formulario de contacto',
      paragraphs: [
        `De: ${d.name} <${d.email}> · idioma ${d.locale}${d.page ? ` · desde ${d.page}` : ''}`,
        `Tema: ${d.topic}`,
        d.message,
        'Responde a este correo para contestarle.',
      ],
      cta: null,
    }),
  },
  footer: {
    transactional: 'Recibes este correo porque tienes una cuenta o un pedido en StoryNido.',
    marketing: 'Recibes este correo porque aceptaste novedades de StoryNido.',
    unsubscribe: 'Dejar de recibir estos correos',
    help: '¿Dudas? Responde a este correo.',
  },
};

const en: LocaleCopy = {
  templates: {
    welcome: (d) => ({
      subject: 'Welcome to StoryNido',
      preview: 'Your account is ready to create stories starring your little one.',
      heading: d.name ? `Hi, ${d.name}!` : 'Hi!',
      paragraphs: [
        'Your account is ready. StoryNido creates an illustrated story starring your child: their name, their face and the things they love.',
        'The preview is free: see the story and the first illustrations before you decide.',
      ],
      cta: cta('Create a story', d.url),
    }),
    preview_ready: (d) => ({
      subject: `Your preview of “${d.bookTitle}” is ready`,
      preview: `See how ${d.childName} looks in their story.`,
      heading: 'Your preview is ready',
      paragraphs: [
        `You can now see the cover and the first pages of “${d.bookTitle}”, starring ${d.childName}.`,
        'If you like it, choose a format and we’ll create the whole book.',
      ],
      cta: cta('See the preview', d.url),
    }),
    draft_reminder: (d) => ({
      subject: `${d.childName}’s story is waiting for you`,
      preview: 'Your draft is saved: pick it up whenever you like.',
      heading: `${d.childName}’s story is still saved`,
      paragraphs: [
        'You left a story halfway. It’s saved exactly as you left it, so you can pick it up whenever you like.',
      ],
      cta: cta('Continue the story', d.url),
    }),
    payment_confirmed: (d) => ({
      subject: `Payment received: “${d.bookTitle}”`,
      preview: 'We’ve started creating your book.',
      heading: 'Thank you for your order!',
      paragraphs: [
        `We’ve confirmed your payment for “${d.bookTitle}” (${FORMATS.en[d.format]}). Total: ${d.total}.`,
        'We’ve started creating it: we illustrate every page and review it. We’ll email you at every step.',
      ],
      cta: cta('View my order', d.url),
    }),
    digital_ready: (d) => ({
      subject: `“${d.bookTitle}” is ready!`,
      preview: 'You can now download your book.',
      heading: 'Your book is ready!',
      paragraphs: [
        `“${d.bookTitle}” is finished. Download it from your order anytime: the download link is created on the spot, just for your account.`,
      ],
      cta: cta('Download my book', d.url),
    }),
    print_sent: (d) => ({
      subject: `“${d.bookTitle}” is at the printer`,
      preview: 'Your printed book is heading into production.',
      heading: 'Your book is at the printer',
      paragraphs: [
        `“${d.bookTitle}” is finished and on its way to print. Estimated production and shipping: ${d.etaDaysMin} to ${d.etaDaysMax} business days.`,
        'In the meantime, you can already download the digital version from your order.',
      ],
      cta: cta('View my order', d.url),
    }),
    print_in_production: (d) => ({
      subject: `We’re printing “${d.bookTitle}”`,
      preview: 'Your book is being printed.',
      heading: 'Your book is being printed',
      paragraphs: [
        `The printer has started producing “${d.bookTitle}”. We’ll let you know when it ships.`,
      ],
      cta: cta('View my order', d.url),
    }),
    shipped: (d) => ({
      subject: `“${d.bookTitle}” is on its way`,
      preview: 'Your book has left the printer.',
      heading: 'Your book is on its way',
      paragraphs: [
        `“${d.bookTitle}” has left the printer.`,
        d.trackingNumber
          ? `Tracking number: ${d.trackingNumber}.`
          : 'We’ll let you know as soon as we have a tracking number.',
      ],
      cta: d.trackingUrl ? cta('Track shipment', d.trackingUrl) : cta('View my order', d.url),
    }),
    delivered: (d) => ({
      subject: `“${d.bookTitle}” was delivered`,
      preview: 'We hope you enjoy it.',
      heading: 'Your book has arrived!',
      paragraphs: [
        `“${d.bookTitle}” shows as delivered. We hope you enjoy reading it together.`,
        'If anything arrived damaged, just reply to this email and we’ll sort it out.',
      ],
      cta: cta('View my order', d.url),
    }),
    refunded: (d) => ({
      subject: `Refund for “${d.bookTitle}”`,
      preview: 'We’ve processed your refund.',
      heading: 'We’ve processed your refund',
      paragraphs: [
        `We’ve refunded ${d.total} for “${d.bookTitle}”. Depending on your bank, it may take a few days to show up.`,
      ],
      cta: null,
    }),
    cancelled: (d) => ({
      subject: `Your order for “${d.bookTitle}” was cancelled`,
      preview: 'Your order was cancelled.',
      heading: 'Your order was cancelled',
      paragraphs: [
        `We cancelled the order for “${d.bookTitle}”. If you didn’t ask for this or have questions, reply to this email.`,
      ],
      cta: null,
    }),
    data_deleted: (d) => ({
      subject: 'We deleted your data',
      preview: 'Confirmation of your data deletion.',
      heading: 'We deleted your data',
      paragraphs: [
        d.scope === 'account'
          ? 'We deleted your account, profiles, photos and drafts. Paid orders are kept for billing only.'
          : 'We deleted the profile, photos and drafts you asked for. Books already ordered are kept.',
      ],
      cta: null,
    }),
    review_request: (d) => ({
      subject: `How did you like “${d.bookTitle}”?`,
      preview: 'Your feedback helps us improve.',
      heading: 'How did you like the book?',
      paragraphs: [
        `You received “${d.bookTitle}” a few days ago. We’d love to hear what you thought: it takes a minute and helps us a lot.`,
      ],
      cta: cta('Leave my review', d.url),
    }),
    new_book_suggestion: (d) => {
      const who = d.childName ? ` for ${d.childName}` : '';
      const occasion = d.occasion === 'christmas' ? 'Christmas' : 'Children’s Day';
      return {
        subject: `A new story${who} for ${occasion}`,
        preview: `${occasion} is coming: a gift made just for them.`,
        heading: `${occasion} is coming`,
        paragraphs: [
          `How about a new story${who}? Pick another adventure and create the free preview.`,
        ],
        cta: cta('Create a story', d.url),
      };
    },
    admin_alert: (d) => es.templates.admin_alert(d),
    contact_message: (d) => es.templates.contact_message(d),
  },
  footer: {
    transactional:
      'You’re receiving this email because you have an account or an order with StoryNido.',
    marketing: 'You’re receiving this email because you opted in to StoryNido news.',
    unsubscribe: 'Unsubscribe from these emails',
    help: 'Questions? Just reply to this email.',
  },
};

const pt: LocaleCopy = {
  templates: {
    welcome: (d) => ({
      subject: 'Boas-vindas ao StoryNido',
      preview: 'Sua conta está pronta para criar histórias com o seu pequeno.',
      heading: d.name ? `Olá, ${d.name}!` : 'Olá!',
      paragraphs: [
        'Sua conta está pronta. Com o StoryNido você cria uma história ilustrada em que a criança é a protagonista: com o nome, o rostinho e o que ela mais gosta.',
        'A prévia é grátis: você vê a história e as primeiras ilustrações antes de decidir.',
      ],
      cta: cta('Criar uma história', d.url),
    }),
    preview_ready: (d) => ({
      subject: `A prévia de “${d.bookTitle}” está pronta`,
      preview: `Veja como ${d.childName} ficou na história.`,
      heading: 'Sua prévia está pronta',
      paragraphs: [
        `Você já pode ver a capa e as primeiras páginas de “${d.bookTitle}”, com ${d.childName} como protagonista.`,
        'Se gostar, escolha o formato e criamos o livro completo.',
      ],
      cta: cta('Ver a prévia', d.url),
    }),
    draft_reminder: (d) => ({
      subject: `A história de ${d.childName} está esperando por você`,
      preview: 'Seu rascunho ficou salvo: continue quando quiser.',
      heading: `A história de ${d.childName} continua salva`,
      paragraphs: [
        'Você deixou uma história pela metade. Ela está salva do jeito que você deixou: continue quando quiser.',
      ],
      cta: cta('Continuar a história', d.url),
    }),
    payment_confirmed: (d) => ({
      subject: `Recebemos seu pagamento: “${d.bookTitle}”`,
      preview: 'Começamos a criar o seu livro.',
      heading: 'Obrigado pela compra!',
      paragraphs: [
        `Confirmamos o pagamento de “${d.bookTitle}” (${FORMATS.pt[d.format]}). Total: ${d.total}.`,
        'Já começamos a criá-lo: ilustramos cada página e revisamos. Avisamos você por e-mail a cada etapa.',
      ],
      cta: cta('Ver meu pedido', d.url),
    }),
    digital_ready: (d) => ({
      subject: `“${d.bookTitle}” está pronto!`,
      preview: 'Você já pode baixar o seu livro.',
      heading: 'Seu livro está pronto!',
      paragraphs: [
        `Terminamos “${d.bookTitle}”. Baixe pelo seu pedido quando quiser: o link de download é criado na hora, só para a sua conta.`,
      ],
      cta: cta('Baixar meu livro', d.url),
    }),
    print_sent: (d) => ({
      subject: `“${d.bookTitle}” está na gráfica`,
      preview: 'Seu livro impresso vai para a produção.',
      heading: 'Seu livro está na gráfica',
      paragraphs: [
        `Terminamos “${d.bookTitle}” e enviamos para impressão. Prazo estimado de produção e envio: ${d.etaDaysMin} a ${d.etaDaysMax} dias úteis.`,
        'Enquanto isso, você já pode baixar a versão digital pelo seu pedido.',
      ],
      cta: cta('Ver meu pedido', d.url),
    }),
    print_in_production: (d) => ({
      subject: `Estamos imprimindo “${d.bookTitle}”`,
      preview: 'Seu livro já está sendo impresso.',
      heading: 'Seu livro está sendo impresso',
      paragraphs: [`A gráfica começou a produzir “${d.bookTitle}”. Avisamos quando sair.`],
      cta: cta('Ver meu pedido', d.url),
    }),
    shipped: (d) => ({
      subject: `“${d.bookTitle}” está a caminho`,
      preview: 'Seu livro saiu da gráfica.',
      heading: 'Seu livro está a caminho',
      paragraphs: [
        `“${d.bookTitle}” saiu da gráfica.`,
        d.trackingNumber
          ? `Código de rastreio: ${d.trackingNumber}.`
          : 'Avisamos assim que tivermos o código de rastreio.',
      ],
      cta: d.trackingUrl ? cta('Acompanhar o envio', d.trackingUrl) : cta('Ver meu pedido', d.url),
    }),
    delivered: (d) => ({
      subject: `“${d.bookTitle}” foi entregue`,
      preview: 'Esperamos que vocês aproveitem muito.',
      heading: 'Seu livro chegou!',
      paragraphs: [
        `“${d.bookTitle}” consta como entregue. Esperamos que vocês aproveitem a leitura juntos.`,
        'Se algo chegou com problema, responda a este e-mail e resolvemos.',
      ],
      cta: cta('Ver meu pedido', d.url),
    }),
    refunded: (d) => ({
      subject: `Reembolso de “${d.bookTitle}”`,
      preview: 'Processamos o seu reembolso.',
      heading: 'Processamos o seu reembolso',
      paragraphs: [
        `Reembolsamos ${d.total} por “${d.bookTitle}”. Dependendo do seu banco, pode levar alguns dias para aparecer.`,
      ],
      cta: null,
    }),
    cancelled: (d) => ({
      subject: `Cancelamos o pedido de “${d.bookTitle}”`,
      preview: 'Seu pedido foi cancelado.',
      heading: 'Seu pedido foi cancelado',
      paragraphs: [
        `Cancelamos o pedido de “${d.bookTitle}”. Se você não pediu isso ou tiver dúvidas, responda a este e-mail.`,
      ],
      cta: null,
    }),
    data_deleted: (d) => ({
      subject: 'Apagamos os seus dados',
      preview: 'Confirmação da exclusão de dados.',
      heading: 'Apagamos os seus dados',
      paragraphs: [
        d.scope === 'account'
          ? 'Apagamos sua conta, os perfis, as fotos e os rascunhos. Os pedidos pagos são mantidos só para faturamento.'
          : 'Apagamos o perfil, as fotos e os rascunhos que você pediu. Os livros já pedidos são mantidos.',
      ],
      cta: null,
    }),
    review_request: (d) => ({
      subject: `O que vocês acharam de “${d.bookTitle}”?`,
      preview: 'Sua opinião nos ajuda a melhorar.',
      heading: 'O que vocês acharam do livro?',
      paragraphs: [
        `Há alguns dias você recebeu “${d.bookTitle}”. Adoraríamos saber o que acharam: leva um minuto e nos ajuda muito.`,
      ],
      cta: cta('Deixar minha opinião', d.url),
    }),
    new_book_suggestion: (d) => {
      const who = d.childName ? ` para ${d.childName}` : '';
      const occasion = d.occasion === 'christmas' ? 'o Natal' : 'o Dia das Crianças';
      return {
        subject: `Uma história nova${who} para ${occasion}`,
        preview: `${occasion === 'o Natal' ? 'O Natal' : 'O Dia das Crianças'} está chegando: um presente feito sob medida.`,
        heading: `${occasion === 'o Natal' ? 'O Natal' : 'O Dia das Crianças'} está chegando`,
        paragraphs: [
          `Que tal uma história nova${who}? Escolha outra aventura e crie a prévia grátis.`,
        ],
        cta: cta('Criar uma história', d.url),
      };
    },
    admin_alert: (d) => es.templates.admin_alert(d),
    contact_message: (d) => es.templates.contact_message(d),
  },
  footer: {
    transactional: 'Você recebe este e-mail porque tem uma conta ou um pedido no StoryNido.',
    marketing: 'Você recebe este e-mail porque aceitou receber novidades do StoryNido.',
    unsubscribe: 'Deixar de receber estes e-mails',
    help: 'Dúvidas? Responda a este e-mail.',
  },
};

export const COPY: Record<Locale, LocaleCopy> = { es, en, pt };
