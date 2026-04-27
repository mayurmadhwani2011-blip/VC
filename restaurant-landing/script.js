const copy = {
	en: {
		pageTitle: "Dunia Al Bukhari | Connect With Us",
		socialRegion: "Social media links",
		brandName: "Dunia Al Bukhari",
		tagline: "Fresh flavors, warm ambiance, and memorable evenings.",
		instagram: "Instagram",
		facebook: "Facebook",
		whatsapp: "WhatsApp",
		whatsappSub: "Chat with us",
		youtube: "YouTube",
		youtubeSub: "Dunia Al Bukhari Kitchen",
		location: "Location",
		locationSub: "Get directions",
		hours: "Open daily: 12:00 PM - 11:00 PM",
		phone: "Call: +91 99999 99999",
		address: "123 Flavor Street, Your City"
	},
	ar: {
		pageTitle: "دنيا البخاري | تواصل معنا",
		socialRegion: "روابط التواصل الاجتماعي",
		brandName: "دنيا البخاري",
		tagline: "نكهات طازجة، أجواء دافئة، وأمسيات لا تنسى.",
		instagram: "إنستغرام",
		facebook: "فيسبوك",
		whatsapp: "واتساب",
		whatsappSub: "تواصل معنا",
		youtube: "يوتيوب",
		youtubeSub: "مطبخ دنيا البخاري",
		location: "الموقع",
		locationSub: "الحصول على الاتجاهات",
		hours: "مفتوح يوميا: 12:00 م - 11:00 م",
		phone: "اتصل: +91 99999 99999",
		address: "123 شارع فليفر، مدينتك"
	}
};

function setLanguage(lang) {
	const selected = copy[lang] ? lang : "en";
	const html = document.documentElement;
	const rtl = selected === "ar";

	html.lang = selected;
	html.dir = rtl ? "rtl" : "ltr";
	document.title = copy[selected].pageTitle;

	document.querySelectorAll("[data-i18n]").forEach((node) => {
		const key = node.getAttribute("data-i18n");
		if (copy[selected][key]) {
			node.textContent = copy[selected][key];
		}
	});

	document.querySelectorAll("[data-i18n-aria-label]").forEach((node) => {
		const key = node.getAttribute("data-i18n-aria-label");
		if (copy[selected][key]) {
			node.setAttribute("aria-label", copy[selected][key]);
		}
	});

	document.querySelectorAll(".lang-btn").forEach((button) => {
		button.classList.toggle("is-active", button.dataset.lang === selected);
	});

	localStorage.setItem("restaurant-lang", selected);
}

document.querySelectorAll(".lang-btn").forEach((button) => {
	button.addEventListener("click", () => setLanguage(button.dataset.lang));
});

setLanguage(localStorage.getItem("restaurant-lang") || "en");
