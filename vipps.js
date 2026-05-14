exports.handler = async (event) => {
  console.log("VIPPS FUNCTION STARTET");

  if (event.httpMethod !== "POST") {
    console.log("Feil metode:", event.httpMethod);

    return {
      statusCode: 405,
      body: JSON.stringify({ error: "Method not allowed" })
    };
  }

  try {
    const body = JSON.parse(event.body || "{}");

    console.log("Mottatt body:", body);

    const amount = Number(body.amount);
    const description = body.description || "Betaling NICO CARS AS";

    if (!amount || amount <= 0) {
      console.error("Ugyldig beløp:", amount);

      return {
        statusCode: 400,
        body: JSON.stringify({ error: "Ugyldig beløp" })
      };
    }

    const baseUrl = process.env.VIPPS_BASE_URL || "https://api.vipps.no";
    const frontendUrl = process.env.FRONTEND_URL || "https://nicocars.com";

    console.log("VIPPS_BASE_URL:", baseUrl);
    console.log("FRONTEND_URL:", frontendUrl);
    console.log("VIPPS_MSN:", process.env.VIPPS_MSN);

    const required = [
      "VIPPS_CLIENT_ID",
      "VIPPS_CLIENT_SECRET",
      "VIPPS_SUBSCRIPTION_KEY",
      "VIPPS_MSN"
    ];

    for (const key of required) {
      if (!process.env[key]) {
        console.error("Mangler environment variable:", key);

        return {
          statusCode: 500,
          body: JSON.stringify({
            error: `Mangler environment variable: ${key}`
          })
        };
      }
    }

    console.log("Henter Vipps access token...");

    const tokenResponse = await fetch(`${baseUrl}/accesstoken/get`, {
      method: "POST",
      headers: {
        "client_id": process.env.VIPPS_CLIENT_ID,
        "client_secret": process.env.VIPPS_CLIENT_SECRET,
        "Ocp-Apim-Subscription-Key": process.env.VIPPS_SUBSCRIPTION_KEY,
        "Merchant-Serial-Number": process.env.VIPPS_MSN
      }
    });

    const tokenData = await tokenResponse.json();

    if (!tokenResponse.ok || !tokenData.access_token) {
      console.error("VIPPS TOKEN ERROR:", tokenData);

      return {
        statusCode: 500,
        body: JSON.stringify({
          error: "Kunne ikke hente Vipps access token",
          details: tokenData
        })
      };
    }

    console.log("Access token OK");

    const reference = `NICO-${Date.now()}`;

    console.log("Oppretter betaling:", {
      reference,
      amount,
      description
    });

    const paymentResponse = await fetch(`${baseUrl}/epayment/v1/payments`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${tokenData.access_token}`,
        "Content-Type": "application/json",
        "Ocp-Apim-Subscription-Key": process.env.VIPPS_SUBSCRIPTION_KEY,
        "Merchant-Serial-Number": process.env.VIPPS_MSN,
        "Idempotency-Key": reference,
        "Vipps-System-Name": "NicoCars",
        "Vipps-System-Version": "1.0",
        "Vipps-System-Plugin-Name": "Netlify",
        "Vipps-System-Plugin-Version": "1.0"
      },
      body: JSON.stringify({
        amount: {
          currency: "NOK",
          value: Math.round(amount * 100)
        },
        paymentMethod: {
          type: "WALLET"
        },
        reference,
        returnUrl: `${frontendUrl}/`,
        userFlow: "WEB_REDIRECT",
        paymentDescription: description
      })
    });

    const paymentData = await paymentResponse.json();

    if (!paymentResponse.ok) {
      console.error("VIPPS PAYMENT ERROR:", paymentData);

      return {
        statusCode: 500,
        body: JSON.stringify({
          error: "Kunne ikke opprette Vipps betaling",
          details: paymentData
        })
      };
    }

    console.log("Vipps betaling opprettet:", paymentData);

    return {
      statusCode: 200,
      body: JSON.stringify({
        reference,
        redirectUrl: paymentData.redirectUrl || paymentData.url,
        vippsResponse: paymentData
      })
    };

  } catch (error) {
    console.error("VIPPS FEIL:", error);

    return {
      statusCode: 500,
      body: JSON.stringify({
        error: error.message
      })
    };
  }
};