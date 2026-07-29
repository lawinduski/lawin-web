// 1. Mobile Menu Toggle
const menuBtn = document.getElementById('menu-btn');
const navLinks = document.getElementById('nav-links');

if (menuBtn) {
    menuBtn.addEventListener('click', () => {
        navLinks.classList.toggle('show');
        const icon = menuBtn.querySelector('i');
        icon.classList.toggle('fa-bars');
        icon.classList.toggle('fa-times');
    });
}

// 2. Dark/Light Theme Switcher
const themeToggle = document.getElementById('theme-toggle');
if (themeToggle) {
    const themeIcon = themeToggle.querySelector('i');
    themeToggle.addEventListener('click', () => {
        document.body.classList.toggle('light-theme');
        if (document.body.classList.contains('light-theme')) {
            themeIcon.classList.replace('fa-moon', 'fa-sun');
        } else {
            themeIcon.classList.replace('fa-sun', 'fa-moon');
        }
    });
}

// 3. Live Slide-in Animations on Page Load & Scroll
window.addEventListener('scroll', () => {
    const slideElements = document.querySelectorAll('.slide-left, .slide-right, .slide-up');
    slideElements.forEach(element => {
        const windowHeight = window.innerHeight;
        const elementTop = element.getBoundingClientRect().top;
        const elementVisible = 100;
        
        if (elementTop < windowHeight - elementVisible) {
            element.classList.add('active-slide');
        }
    });
});

// Trigger on load for elements in view
window.addEventListener('DOMContentLoaded', () => {
    const slideElements = document.querySelectorAll('.slide-left, .slide-right, .slide-up');
    slideElements.forEach(element => {
        const elementTop = element.getBoundingClientRect().top;
        if (elementTop < window.innerHeight) {
            element.classList.add('active-slide');
        }
    });
});

// 4. Interactive Live Button Click Glow & Ripple Effect
const buttons = document.querySelectorAll('.btn-primary, .btn-secondary, #theme-toggle');
buttons.forEach(button => {
    button.addEventListener('click', function(e) {
        const rect = this.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        
        const ripple = document.createElement('span');
        ripple.classList.add('ripple');
        ripple.style.left = `${x}px`;
        ripple.style.top = `${y}px`;
        
        this.appendChild(ripple);
        
        setTimeout(() => {
            ripple.remove();
        }, 600);
    });
});

// 5. Live Contact Form Submission
const contactForm = document.getElementById('contact-form');
if (contactForm) {
    const formStatus = document.getElementById('form-status');
    contactForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const name = document.getElementById('name').value;
        formStatus.textContent = `Thank you, ${name}! Your message has been sent live successfully.`;
        contactForm.reset();
        setTimeout(() => {
            formStatus.textContent = '';
        }, 5000);
    });
}
