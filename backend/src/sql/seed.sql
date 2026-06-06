INSERT INTO Roles (name, description) VALUES
('admin', 'Full system access'),
('manager', 'Agency manager access'),
('creator', 'Content creator access');

INSERT INTO Platforms (name, code, base_url, is_active) VALUES
('Instagram', 'instagram', 'https://www.instagram.com', 1),
('Facebook', 'facebook', 'https://www.facebook.com', 1),
('LinkedIn', 'linkedin', 'https://www.linkedin.com', 1);
