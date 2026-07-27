export interface AnnouncementLink {
  title: string;
  url: string;
}

export interface Announcement {
  id: string;
  title: string;
  description: string;
  links: AnnouncementLink[];
  createdAt: Date;
  authorName: string;
  adminId: string;
  authorPosition?: string;
}

export interface CreateAnnouncementPayload {
  title: string;
  description: string;
  links: AnnouncementLink[];
  authorName: string;
  adminId: string;
  authorPosition?: string;
}
