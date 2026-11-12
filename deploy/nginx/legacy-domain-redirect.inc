# Include inside BOTH existing legacy-domain server blocks (HTTP and HTTPS).
# Keep the current ssl_certificate directives and existing Certbot configuration.
# The ACME exception allows the old HTTPS certificate to keep renewing.
if ($uri !~ "^/[.]well-known/acme-challenge/") {
    return 301 https://kickboxing19.ru$request_uri;
}
