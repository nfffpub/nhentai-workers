// Website you intended to retrieve for users.
const upstream = 'https://nhentai.net'

const matchKey = 'nhentai'

const proxyPart = 'nh_p_path/'

// Custom pathname for the upstream website.
const upstream_path = '/'

addEventListener('fetch', event => {
    event.respondWith(fetchAndApply(event.request));
})

async function fetchAndApply(request) {
    const region = request.headers.get('cf-ipcountry').toUpperCase();
    const ip_address = request.headers.get('cf-connecting-ip');
    const user_agent = request.headers.get('user-agent');

    let response = null;

    let reqUrl = request.url;
    let reqUrlObj = new URL(reqUrl);
    let url_hostname = reqUrlObj.host;
    let reqUrlPart = reqUrl.split(proxyPart);
    let url = null;
    if (reqUrlPart.length != 2) {
        if (reqUrlObj.pathname == '/') {
            url = new URL(upstream_path, upstream);
        } else {
            reqUrlObj.host = new URL(upstream).host;
            url = reqUrlObj;
        }
    } else {
        url = new URL(decodeURIComponent(reqUrlPart[1]));
    }

    let upstream_domain = url.host;

    let method = request.method;
    let request_headers = request.headers;
    let new_request_headers = new Headers(request_headers);

    new_request_headers.set('Host', url.host);
    new_request_headers.set('Referer', "");

    let original_response = await fetch(url.href, {
        method: method,
        headers: new_request_headers
    })

    connection_upgrade = new_request_headers.get("Upgrade");
    if (connection_upgrade && connection_upgrade.toLowerCase() == "websocket") {
        return original_response;
    }

    let original_response_clone = original_response.clone();
    let original_text = null;
    let response_headers = original_response.headers;
    let new_response_headers = new Headers(response_headers);
    let status = original_response.status;

    new_response_headers.set('access-control-allow-origin', '*');
    new_response_headers.set('access-control-allow-credentials', true);
    new_response_headers.delete('content-security-policy');
    new_response_headers.delete('content-security-policy-report-only');
    new_response_headers.delete('clear-site-data');

    if (new_response_headers.get("x-pjax-url")) {
        new_response_headers.set("x-pjax-url", response_headers.get("x-pjax-url").replace("//" + upstream_domain, "//" + url_hostname));
    }


    const content_type = new_response_headers.get('content-type');
    if (content_type != null && content_type.includes('text/html') && (content_type.includes('UTF-8') ||
        content_type.includes('utf-8'))) {
        original_text = await replace_response_text(original_response_clone, upstream_domain, url_hostname);
    } else {
        original_text = original_response_clone.body
    }

    response = new Response(original_text, {
        status,
        headers: new_response_headers
    })

    return response;
}


async function replace_response_text(response, upstream_domain, host_name) {
    let text = await response.text()

    function convert(match) {
        if (match.includes(matchKey)) {
            return "https://" + host_name + "/" + proxyPart + match;
        }
        return match;
    }

    let re = new RegExp('(https?|ftp|file)://[-A-Za-z0-9+&@#/%?=~_|!:,.;]+[-A-Za-z0-9+&@#/%=~_|]', 'g')
    text = text.replace(re, convert);

    return text;
}
