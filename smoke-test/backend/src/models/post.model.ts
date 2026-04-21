// smoke-test/backend/src/models/post.model.ts

export enum PostStatus {
  Draft = "draft",
  Published = "published",
  Scheduled = "scheduled",
  Archived = "archived",
}

export enum PostVisibility {
  Public = "public",
  Private = "private",
  Unlisted = "unlisted",
}

export interface PostMeta {
  slug: string;
  readingTimeMinutes: number;
  coverImageUrl?: string;
  excerpt?: string;
  seoTitle?: string;
  seoDescription?: string;
}

export interface IPost {
  _id: string;
  title: string;
  content: string;
  authorId: string;
  status: PostStatus; // should become union type by default
  visibility: PostVisibility;
  tags: string[];
  meta: PostMeta;
  likesCount: number;
  commentsCount: number;
  viewsCount: number;
  publishedAt?: Date; // should become string
  scheduledAt?: Date; // should become string
  createdAt: Date; // should become string
  updatedAt: Date; // should become string
}

export interface CreatePostDTO {
  title: string;
  content: string;
  tags?: string[];
  status?: PostStatus;
  visibility?: PostVisibility;
  meta?: Partial<PostMeta>;
}

export interface UpdatePostDTO {
  title?: string;
  content?: string;
  tags?: string[];
  status?: PostStatus;
  visibility?: PostVisibility;
  meta?: Partial<PostMeta>;
}

export type ApiResponse<T> = {
  data: T;
  success: boolean;
  message: string;
  pagination?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
};
