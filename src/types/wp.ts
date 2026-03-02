export type WpTerm = {
  id: number;
  taxonomy: string;
  name: string;
  slug: string;
};

export type WpAuthor = {
  id: number;
  name: string;
  slug: string;
};

export type WpFeaturedMedia = {
  id: number;
  source_url?: string;
  media_details?: {
    width?: number;
    height?: number;
  };
  alt_text?: string;
};

export type WpEmbedded = {
  author?: WpAuthor[];
  ["wp:featuredmedia"]?: WpFeaturedMedia[];
  ["wp:term"]?: WpTerm[][];
};

export type WpPost = {
  id: number;
  slug: string;
  date: string;
  link: string;
  title: { rendered: string };
  excerpt: { rendered: string };
  content?: { rendered: string };
  _embedded?: WpEmbedded;
};

export type WpPage = {
  id: number;
  slug: string;
  date: string;
  link: string;
  title: { rendered: string };
  excerpt?: { rendered: string };
  content: { rendered: string };
  _embedded?: WpEmbedded;
};

export type WpListResponse<T> = T[];

export type PostViewModel = {
  id: number;
  slug: string;
  title: string;
  excerptText: string;
  excerptText160: string;
  contentHtml?: string;
  publishedAt: string;
  publishedAtFormatted: string;
  publishedTimeFormatted: string;
  link: string;
  primaryCategoryName: string;
  author: {
    name: string;
    slug: string;
  };
  featuredImage: {
    url: string;
    width: number | null;
    height: number | null;
    alt: string;
  } | null;
  categories: Array<{ id: number; name: string; slug: string }>;
  tags: Array<{ id: number; name: string; slug: string }>;
};

export type PageViewModel = {
  id: number;
  slug: string;
  title: string;
  excerptText: string;
  contentHtml: string;
  publishedAt: string;
  link: string;
};
