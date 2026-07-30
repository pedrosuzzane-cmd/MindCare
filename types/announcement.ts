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
  expiresAt: Date;
  authorName: string;
  adminId: string;
  authorPosition?: string;
  targetDepartments: string[];
}

export interface CreateAnnouncementPayload {
  title: string;
  description: string;
  links: AnnouncementLink[];
  authorName: string;
  adminId: string;
  authorPosition?: string;
  targetDepartments: string[];
}

export interface UpdateAnnouncementPayload {
  title: string;
  description: string;
  links: AnnouncementLink[];
  authorName: string;
  authorPosition?: string;
  targetDepartments: string[];
}
