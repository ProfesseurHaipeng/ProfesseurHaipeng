export type MediaRef = {
  src: string
  alt: string
}

export type TextBlock = {
  id: string
  title: string
  body: string
}

export type NavItem = {
  id: string
  label: string
  href: string
}

export type Cta = {
  label: string
  href: string
}

export type Mineral = {
  id: string
  name: string
  symbol: string
  body: string
}

export type AssayRow = {
  id: string
  name: string
  symbol: string
  amount: string
  meaning: string
}

export type ProcessStep = {
  id: string
  title: string
  body: string
}

export type PackOption = {
  id: string
  title: string
  body: string
}

export type Region = {
  id: string
  name: string
  soil: string
  crops: string
  directions: string
}

export type RegionGroup = {
  id: string
  title: string
  insight: string
  regions: Region[]
}

export type CropScheme = {
  id: string
  crop: string
  value: string
  dosage: string
  method: string
  image: MediaRef
}

export type CaseStudy = {
  id: string
  title: string
  intro: string
  background: string
  solution: string
  effects: string[]
  value: string
  image: MediaRef
}

export type ContactChannels = {
  email: string
  phone: string
  wechat: string
  address: string
}

export type MediaAsset = {
  id: string
  src: string
  alt: string
  note: string
}

export type GapStatus = "empty" | "draft" | "ready"

export type ContentGap = {
  id: string
  label: string
  why: string
  example: string
  status: GapStatus
  value: string
}

export type LabeledImage = MediaRef & {
  id: string
}

export type VideoItem = {
  id: string
  title: string
  body: string
  url: string
}

export type SiteContent = {
  schemaVersion: 1
  updatedAt: string
  settings: {
    brandName: string
    brandStatus: string
    productName: string
    latinName: string
    projectName: string
    tagline: string
    audience: string
    description: string
    footerNote: string
    contactHint: string
    noIndex: boolean
    channels: ContactChannels
    brochureUrl: string
  }
  nav: NavItem[]
  hero: {
    kicker: string
    title: string
    subtitle: string
    points: string[]
    image: MediaRef
    primaryCta: Cta
    secondaryCta: Cta
  }
  overview: {
    kicker: string
    title: string
    intro: string[]
    pillars: TextBlock[]
    strategyTitle: string
    strategyLead: string
    strategyLayers: TextBlock[]
    valuesTitle: string
    valuesImage: MediaRef
    craterImage: MediaRef
    values: TextBlock[]
  }
  resource: {
    kicker: string
    title: string
    backgroundTitle: string
    background: string[]
    image: MediaRef
    eruptionImage: MediaRef
    formationTitle: string
    formationLead: string
    formationSteps: ProcessStep[]
    formationNote: string
    traitsTitle: string
    traits: TextBlock[]
    mineralsTitle: string
    mineralsLead: string
    minerals: Mineral[]
  }
  supply: {
    kicker: string
    title: string
    mineTitle: string
    mineBody: string
    mineImage: MediaRef
    minePhotos: LabeledImage[]
    rawTitle: string
    rawImage: MediaRef
    rawPoints: TextBlock[]
    processTitle: string
    processNote: string
    process: ProcessStep[]
    shippingTitle: string
    shippingImage: MediaRef
    shipping: TextBlock[]
    shippingNote: string
  }
  products: {
    kicker: string
    title: string
    sourceTitle: string
    source: string[]
    warehouseImage: MediaRef
    stats: { id: string; value: string; label: string; body: string }[]
    directionsTitle: string
    directions: TextBlock[]
    soilTitle: string
    soilImage: MediaRef
    soil: TextBlock[]
    fertilizerTitle: string
    fertilizerLead: string
    fertilizer: TextBlock[]
    livestockTitle: string
    livestockImage: MediaRef
    livestock: TextBlock[]
    otherTitle: string
    other: TextBlock[]
    packTitle: string
    packs: PackOption[]
    capacityTitle: string
    capacity: TextBlock[]
    customersTitle: string
    customers: string[]
  }
  testing: {
    kicker: string
    title: string
    intro: string
    image: MediaRef
    layers: TextBlock[]
    docsTitle: string
    docs: TextBlock[]
    assayTitle: string
    assayLead: string
    assay: AssayRow[]
    assayNote: string
  }
  market: {
    kicker: string
    title: string
    lead: string
    image: MediaRef
    groups: RegionGroup[]
  }
  solutions: {
    kicker: string
    title: string
    crops: string
    image: MediaRef
    schemes: CropScheme[]
    extrasTitle: string
    extras: TextBlock[]
    principlesTitle: string
    principles: string[]
  }
  cases: {
    kicker: string
    title: string
    image: MediaRef
    items: CaseStudy[]
    compareTitle: string
    compareLead: string
    beforeTitle: string
    before: string[]
    afterTitle: string
    after: string[]
  }
  videos: {
    kicker: string
    title: string
    lead: string
    items: VideoItem[]
    note: string
  }
  contact: {
    kicker: string
    title: string
    lead: string
    image: MediaRef
    cards: TextBlock[]
    slogan: string
    formName: string
  }
  media: MediaAsset[]
  gaps: ContentGap[]
}

export type ContentModuleId =
  | "gaps"
  | "media"
  | "settings"
  | "hero"
  | "overview"
  | "resource"
  | "supply"
  | "products"
  | "testing"
  | "market"
  | "solutions"
  | "cases"
  | "videos"
  | "contact"
  | "nav"
