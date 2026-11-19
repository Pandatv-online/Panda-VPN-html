// Order form → Telegram via the pandavpn-relay Cloudflare Worker.
// The bot token is NOT stored here: anything shipped to the browser can be
// read by any visitor. The Worker keeps the token as a Cloudflare secret
// (see relay/README.md).
const RELAY_URL = "https://pandavpn-relay.pandatv-eu.workers.dev";

document.addEventListener("DOMContentLoaded", function () {
    const form = document.getElementById("contact-form");
    if (!form) return;

    const response = document.querySelector(".ajax-response");
    const value = (name) => {
        const el = form.querySelector(`[name="${name}"]`);
        return el ? el.value.trim() : "";
    };

    form.addEventListener("submit", async function (e) {
        e.preventDefault();

        const button = form.querySelector('[type="submit"]');
        if (button) button.disabled = true;

        try {
            const res = await fetch(RELAY_URL, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    name: value("name"),
                    telegram: value("telegram"),
                    plan: value("plan"),
                    device: value("device"),
                    message: value("message"),
                }),
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok || !data.ok) throw new Error("relay error");

            if (response) response.innerHTML = "✅ Заявка отправлена! Мы свяжемся с вами в Telegram.";
            form.reset();
        } catch (err) {
            if (response) response.innerHTML = "❌ Ошибка отправки. Попробуйте позже.";
        } finally {
            if (button) button.disabled = false;
        }
    });
});
