/*
* --------------------------------------------------------------
* Generic ZAP Authentication Script
* --------------------------------------------------------------
*
* Supports:
*   - FORM authentication
*   - JSON authentication
*   - Optional separate GET URL for dynamic values
*   - Dynamic values from:
*       input
*       header
*       cookie
*       regex
*   - Static extra POST data
*   - Dynamic placeholders:
*       {%username%}
*       {%password%}
*       {%csrf_token%}
*       {%user_token%}
*       etc.
*
* Authentication flow:
*
* If Login_GET_URL is provided:
*
*   GET Login_GET_URL
*          |
*          +--> extract dynamic fields
*          |
*          +--> preserve cookies
*          |
*          v
*      build POST
*          |
*          v
*   POST Login_URL
*
* If Login_GET_URL is NOT provided:
*
*      build POST
*          |
*          v
*   POST Login_URL
*
* --------------------------------------------------------------
*/


/*
* --------------------------------------------------------------
* authenticate()
* --------------------------------------------------------------
*/
function authenticate(helper, paramsValues, credentials) {

    var loginUrl = paramsValues.get("Login_URL");
    var loginGetUrl = paramsValues.get("Login_GET_URL");

    var type = paramsValues.get("TYPE");
    var usernameField = paramsValues.get("Username_field");
    var passwordField = paramsValues.get("Password_field");

    var extraPostData = paramsValues.get("Extra_Post_Data");
    var dynamicFieldsConfig = paramsValues.get("Dynamic_Fields");

    var username = credentials.getParam("Username");
    var password = credentials.getParam("Password");

    var dynamicValues = {};
    var loginGetMsg = null;


    /*
    * ----------------------------------------------------------
    * Validate required parameters
    * ----------------------------------------------------------
    */

    if (!loginUrl || loginUrl.trim().length === 0) {
        throw "Login_URL cannot be empty";
    }

    if (!type || type.trim().length === 0) {
        type = "FORM"
    }

    type = type.toUpperCase();


    /*
    * ----------------------------------------------------------
    * Optional GET flow
    *
    * IMPORTANT:
    *
    * If Login_GET_URL is NOT provided:
    *   - Do NOT perform GET
    *   - Do NOT extract dynamic fields
    *   - Do NOT copy cookies
    *
    * ----------------------------------------------------------
    */

    if (loginGetUrl && loginGetUrl.trim().length > 0) {

        loginGetMsg = sendAndReceive(helper, loginGetUrl);

        /*
        * Extract dynamic fields only when GET is configured.
        */
        if (dynamicFieldsConfig &&
            dynamicFieldsConfig.trim().length > 0) {

            dynamicValues = extractDynamicFields(
                loginGetMsg,
                dynamicFieldsConfig
            );
        }
    }


    /*
    * ----------------------------------------------------------
    * Create variables available for substitution
    * ----------------------------------------------------------
    */

    var variables = {};

    variables["username"] = username;
    variables["password"] = password;


    /*
    * Add extracted dynamic values.
    */
    for (var key in dynamicValues) {
        variables[key] = dynamicValues[key];
    }


    /*
    * ----------------------------------------------------------
    * Build authentication request
    * ----------------------------------------------------------
    */

    var requestBody = "";
    var contentType = "";


    if (type === "FORM") {

        /*
        * Username/password
        */
        requestBody =
            encodeURIComponent(usernameField) +
            "=" +
            encodeURIComponent(username);

        requestBody +=
            "&" +
            encodeURIComponent(passwordField) +
            "=" +
            encodeURIComponent(password);


        /*
        * Extra static/dynamic POST data
        */
        if (extraPostData &&
            extraPostData.trim().length > 0) {

            var processedExtraData =
                substituteVariables(
                    extraPostData,
                    variables,
                    "FORM"
                );

            if (processedExtraData.length > 0) {
                requestBody += "&" + processedExtraData;
            }
        }

        contentType =
            "application/x-www-form-urlencoded";
    }


    else if (type === "JSON") {

        /*
        * Create JSON object.
        */
        var jsonObj = {};

        jsonObj[usernameField] = username;
        jsonObj[passwordField] = password;


        /*
        * Extra_Post_Data must be a JSON object.
        *
        * Example:
        *
        * {
        *   "tenant": "production",
        *   "csrf_token": "{%csrf_token%}"
        * }
        */
        if (extraPostData &&
            extraPostData.trim().length > 0) {

            var processedJsonData =
                substituteVariables(
                    extraPostData,
                    variables,
                    "JSON"
                );

            try {

                var extraJson =
                    JSON.parse(processedJsonData);

                for (var jsonKey in extraJson) {
                    jsonObj[jsonKey] = extraJson[jsonKey];
                }

            } catch (e) {

                throw (
                    "Extra_Post_Data is not valid JSON: " +
                    e
                );
            }
        }

        requestBody = JSON.stringify(jsonObj);

        contentType = "application/json";
    }


    else {

        throw "Unsupported TYPE: " + type;
    }


    /*
    * ----------------------------------------------------------
    * Create POST request
    * ----------------------------------------------------------
    */

    var msg = helper.prepareMessage();

    var requestUri =
        new org.apache.commons.httpclient.URI(
            loginUrl,
            true
        );

    var requestHeader =
        new org.parosproxy.paros.network.HttpRequestHeader(
            "POST",
            requestUri,
            "HTTP/1.1"
        );

    msg.setRequestHeader(requestHeader);

    msg.setRequestBody(requestBody);

    msg.getRequestHeader().setHeader(
        "Content-Type",
        contentType
    );

    msg.getRequestHeader().setContentLength(
        msg.getRequestBody().length()
    );


    /*
    * ----------------------------------------------------------
    * Copy cookies ONLY when Login_GET_URL was provided.
    *
    * This is important for applications such as DVWA where
    * the dynamic token belongs to the PHP session established
    * during the GET request.
    * ----------------------------------------------------------
    */

    if (loginGetMsg) {

        copyCookies(loginGetMsg, msg);
    }


    /*
    * ----------------------------------------------------------
    * Send authentication request
    * ----------------------------------------------------------
    */

    helper.sendAndReceive(msg);

    return msg;
}

function sendAndReceive(helper, url, postData) {

    var msg = helper.prepareMessage();

    var method = "GET";

    if (postData !== null &&
        postData !== undefined &&
        postData.length > 0) {

        method = "POST";
        msg.setRequestBody(postData);
    }

    try {
        var requestUri =
            new org.apache.commons.httpclient.URI(
                url,
                true
            );
    
        var requestHeader =
            new org.parosproxy.paros.network.HttpRequestHeader(
                method,
                requestUri,
                "HTTP/1.1"
            );
    
        msg.setRequestHeader(requestHeader);
    
        if (postData !== null &&
            postData !== undefined &&
            postData.length > 0) {
    
            msg.getRequestHeader().setContentLength(
                msg.getRequestBody().length()
            );
        }
    
        helper.sendAndReceive(msg);
    
        return msg;
    } catch (e) {
        throw method + " request failed: " + e;
    }
}

/*
* --------------------------------------------------------------
* Extract multiple dynamic fields
* --------------------------------------------------------------
*
* Dynamic_Fields example:
*
* {
*   "user_token": {
*     "source": "input",
*     "name": "user_token"
*   },
*
*   "csrf_token": {
*     "source": "header",
*     "name": "X-CSRF-Token"
*   }
* }
*
* --------------------------------------------------------------
*/
function extractDynamicFields(responseMsg, configString) {

    var result = {};

    var config;

    try {
        config = JSON.parse(configString);
    } catch (e) {
        throw (
            "Dynamic_Fields is not valid JSON: " +
            e
        );
    }


    for (var variableName in config) {

        var fieldConfig = config[variableName];

        var value =
            extractDynamicValue(
                responseMsg,
                fieldConfig
            );


        if (value === null ||
            value === undefined ||
            value.length === 0) {

            throw (
                "Could not extract dynamic field: " +
                variableName
            );
        }


        result[variableName] = value;
    }


    return result;
}


/*
* --------------------------------------------------------------
* extractDynamicValue()
* --------------------------------------------------------------
*
* This function is intentionally isolated so that additional
* extraction types can be added later.
*
* Current sources:
*
*   input
*   header
*   cookie
*   regex
*
* Future possibilities:
*
*   json
*   html_attribute
*   meta
*   xpath
*   css
*   etc.
*
* --------------------------------------------------------------
*/
function extractDynamicValue(responseMsg, config) {

    if (!config || !config.source) {
        throw "Dynamic field source is missing";
    }


    var source =
        config.source.toLowerCase();


    /*
    * ----------------------------------------------------------
    * HTML INPUT
    * ----------------------------------------------------------
    *
    * Example:
    *
    * <input
    *     type="hidden"
    *     name="user_token"
    *     value="abc123"
    * >
    *
    * Configuration:
    *
    * {
    *   "source": "input",
    *   "name": "user_token"
    * }
    *
    * ----------------------------------------------------------
    */

    if (source === "input") {

        if (!config.name) {
            throw "Input extraction requires 'name'";
        }

        var body =
            responseMsg
                .getResponseBody()
                .toString();

        return extractInputFieldValue(
            body,
            config.name
        );
    }


    /*
    * ----------------------------------------------------------
    * RESPONSE HEADER
    * ----------------------------------------------------------
    *
    * Example:
    *
    * X-CSRF-Token: abc123
    *
    * Configuration:
    *
    * {
    *   "source": "header",
    *   "name": "X-CSRF-Token"
    * }
    *
    * ----------------------------------------------------------
    */

    if (source === "header") {

        if (!config.name) {
            throw "Header extraction requires 'name'";
        }

        return extractHeaderValue(
            responseMsg,
            config.name
        );
    }


    /*
    * ----------------------------------------------------------
    * RESPONSE COOKIE
    * ----------------------------------------------------------
    *
    * Example:
    *
    * Set-Cookie: csrf_token=abc123
    *
    * Configuration:
    *
    * {
    *   "source": "cookie",
    *   "name": "csrf_token"
    * }
    *
    * ----------------------------------------------------------
    */

    if (source === "cookie") {

        if (!config.name) {
            throw "Cookie extraction requires 'name'";
        }

        return extractCookieValue(
            responseMsg,
            config.name
        );
    }


    /*
    * ----------------------------------------------------------
    * REGEX
    * ----------------------------------------------------------
    *
    * Example:
    *
    * {
    *   "source": "regex",
    *   "pattern": "\"csrfToken\"\\s*:\\s*\"([^\"]+)\""
    * }
    *
    * ----------------------------------------------------------
    */

    if (source === "regex") {

        if (!config.pattern) {
            throw "Regex extraction requires 'pattern'";
        }

        var responseBody =
            responseMsg
                .getResponseBody()
                .toString();

        return extractRegexValue(
            responseBody,
            config.pattern
        );
    }


    throw (
        "Unsupported dynamic field source: " +
        config.source
    );
}


/*
* --------------------------------------------------------------
* Extract HTML input value
* --------------------------------------------------------------
*/
function extractInputFieldValue(page, fieldName) {

    var Source =
        Java.type(
            "net.htmlparser.jericho.Source"
        );

    var src =
        new Source(page);

    var iterator =
        src.getAllElements("input").iterator();


    while (iterator.hasNext()) {

        var element =
            iterator.next();

        var name =
            element.getAttributeValue("name");


        if (name === fieldName) {

            var value =
                element.getAttributeValue("value");

            if (value === null) {
                return "";
            }

            return value;
        }
    }


    return "";
}


/*
* --------------------------------------------------------------
* Extract response header
* --------------------------------------------------------------
*/
function extractHeaderValue(responseMsg, headerName) {

    var header =
        responseMsg
            .getResponseHeader()
            .getHeader(headerName);

    if (header === null ||
        header === undefined) {

        return "";
    }

    return header.getValue();
}


/*
* --------------------------------------------------------------
* Extract cookie
* --------------------------------------------------------------
*/
function extractCookieValue(responseMsg, cookieName) {

    var headers =
        responseMsg
            .getResponseHeader()
            .getHeaders("Set-Cookie");


    for (var i = 0; i < headers.length; i++) {

        var cookieHeader =
            headers[i].getValue();

        var parts =
            cookieHeader.split(";");


        for (var j = 0; j < parts.length; j++) {

            var part =
                parts[j].trim();

            var separator =
                part.indexOf("=");


            if (separator <= 0) {
                continue;
            }


            var name =
                part.substring(
                    0,
                    separator
                );

            var value =
                part.substring(
                    separator + 1
                );


            if (name === cookieName) {
                return value;
            }
        }
    }


    return "";
}


/*
* --------------------------------------------------------------
* Extract first regex capture group
* --------------------------------------------------------------
*/
function extractRegexValue(text, pattern) {

    var regex =
        new RegExp(pattern);

    var match =
        regex.exec(text);


    if (!match) {
        return "";
    }


    /*
    * If the regex contains a capture group,
    * return the first capture group.
    *
    * Otherwise return the entire match.
    */
    if (match.length > 1) {
        return match[1];
    }


    return match[0];
}


/*
* --------------------------------------------------------------
* Substitute {%variable%} placeholders
* --------------------------------------------------------------
*/
function substituteVariables(
    data,
    variables,
    type
) {

    var result = data;


    for (var name in variables) {

        var value =
            variables[name];

        if (value === null ||
            value === undefined) {

            value = "";
        }


        value = String(value);


        /*
        * FORM values need URL encoding.
        *
        * JSON values are inserted as JSON strings,
        * so escape only the JSON-sensitive characters.
        */
        if (type === "FORM") {

            value =
                encodeURIComponent(value);

        } else if (type === "JSON") {

            value =
                escapeJsonString(value);
        }


        var placeholder =
            "{%" + name + "%}";


        result =
            replaceAll(
                result,
                placeholder,
                value
            );
    }


    return result;
}


/*
* --------------------------------------------------------------
* Escape a value that is going to be inserted inside a JSON
* string.
* --------------------------------------------------------------
*/
function escapeJsonString(value) {

    return value
        .replace(/\\/g, "\\\\")
        .replace(/"/g, "\\\"")
        .replace(/\r/g, "\\r")
        .replace(/\n/g, "\\n")
        .replace(/\t/g, "\\t");
}


/*
* --------------------------------------------------------------
* Replace all occurrences
* --------------------------------------------------------------
*/
function replaceAll(
    text,
    search,
    replacement
) {

    return text.split(search).join(replacement);
}


/*
* --------------------------------------------------------------
* Copy cookies from GET response/request to POST request.
*
* This is ONLY called when Login_GET_URL is configured.
* --------------------------------------------------------------
*/
function copyCookies(sourceMsg, targetMsg) {

    var cookieHeader =
        sourceMsg.getRequestHeader().getHeader("Cookie");

    if (cookieHeader &&
        cookieHeader.length > 0) {

        targetMsg.getRequestHeader().setHeader(
            "Cookie",
            cookieHeader
        );

    }
}


/*
* --------------------------------------------------------------
* logout()
* --------------------------------------------------------------
*/
function logout(
    helper,
    paramsValues,
    credentials
) {
    return null;
}


/*
* --------------------------------------------------------------
* ZAP parameter definitions
* --------------------------------------------------------------
*/
function getRequiredParamsNames() {

    return [
        "Login_URL",
        "TYPE",
        "Username_field",
        "Password_field"
    ];
}


function getOptionalParamsNames() {

    return [
        "Login_GET_URL",
        "Extra_Post_Data",
        "Dynamic_Fields"
    ];
}


function getCredentialsParamsNames() {

    return [
        "Username",
        "Password"
    ];
}