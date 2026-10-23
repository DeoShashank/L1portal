# Serve the static L1 Portal page with nginx
FROM nginx:1.27-alpine

# Copy the portal page in as the site's home page
COPY L1portalv1.html /usr/share/nginx/html/index.html

EXPOSE 80

# nginx's default command starts the web server
