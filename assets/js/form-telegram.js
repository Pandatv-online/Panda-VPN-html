console.log("Файл form-telegram подключен");

document.addEventListener("DOMContentLoaded", function () {

    const form = document.getElementById("contact-form");

    if (form) {
        console.log("Форма найдена");

        form.addEventListener("submit", function(e) {
            e.preventDefault();

            console.log("Форма отправляется");

            const name = document.querySelector('[name="name"]').value;
            const telegram = document.querySelector('[name="telegram"]').value;
            const plan = document.querySelector('[name="plan"]').value;
            const message = document.querySelector('[name="message"]').value;

            const text = `
🆕 Новая заявка VPN

👤 Имя: ${name}
📱 Telegram: ${telegram}
💳 Тариф: ${plan}
💬 Комментарий: ${message}
`;

            fetch(`https://api.telegram.org/bot8376520960:AAGVx_I2zV5tlGeKuNgyXLX8i03i7UYC91Y/sendMessage`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    chat_id: "7405005534",
                    text: text
                })
            })
            .then(() => {
                document.querySelector(".ajax-response").innerHTML =
                "✅ Заявка отправлена! Мы свяжемся с вами в Telegram.";
            })
            .catch(() => {
                document.querySelector(".ajax-response").innerHTML =
                "❌ Ошибка отправки. Попробуйте позже.";
            });
        });
    } else {
        console.log("Форма НЕ найдена");
    }

});