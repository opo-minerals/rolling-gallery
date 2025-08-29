// Utility function for throttling resize events
function throttle(func, limit) {
    let inThrottle;
    let lastArgs;
    let lastContext;
    let lastResult;

    const throttled = function() {
        lastArgs = arguments;
        lastContext = this;
        if (!inThrottle) {
            inThrottle = true;
            setTimeout(() => {
                inThrottle = false;
                if (lastArgs) { // If there were calls during throttle period
                    lastResult = func.apply(lastContext, lastArgs);
                    lastArgs = null;
                    lastContext = null;
                }
            }, limit);
            lastResult = func.apply(this, arguments); // Immediate execution for first call
        }
        return lastResult;
    };
    return throttled;
}

class RollingGallery {
    constructor(containerElement, options) {
        this.container = containerElement;
        this.options = {
            images: [],
            autoplay: false,
            pauseOnHover: false,
            smBreakpoint: 640, // Default breakpoint for 'sm' screen size
            autoplayIntervalMs: 4000, // Time between autoplay rotations (increased for slower rotation)
            autoplayRotationDuration: 3000, // Duration of autoplay rotation animation (increased for slower transition)
            dragFactor: 0.05, // Multiplier for drag sensitivity (how much mouse movement translates to rotation)
            flickDecay: 0.92, // How fast flick velocity decays (closer to 1 = slower decay, more "spin")
            flickMinVelocity: 0.1, // Minimum velocity to continue flick animation
            gapFactor: 0.95, // New: Multiplier for faceWidth to create a gap (0.95 means 5% gap)
            ...options
        };

        this.images = this.options.images; // Use passed images
        if (this.images.length === 0) {
            console.warn("RollingGallery: No images provided. Please provide an array of image URLs.");
            this.images = ["https://via.placeholder.com/300x120?text=No+Images"]; // Fallback
        }

        this.isScreenSizeSm = window.innerWidth <= this.options.smBreakpoint;
        this.rotationDegrees = 0; // Current rotation of the gallery track
        this.autoplayIntervalId = null;
        this.animationFrameId = null; // For flick/continuous animation
        this.isDragging = false;
        this.startX = 0; // Mouse/touch X position at drag start
        this.startRotation = 0; // rotationDegrees at drag start
        this.lastMoveX = 0; // To calculate velocity
        this.lastMoveTime = 0; // To calculate velocity
        this.currentVelocity = 0; // For flick animation

        this.elements = {}; // Store DOM references

        this.init();
    }

    init() {
        this.renderBaseStructure();
        this.getElements();
        this.attachEventListeners();
        this.renderGalleryItems(); // Render initial images
        this.updateTransform(); // Apply initial 3D transforms

        if (this.options.autoplay) {
            this.startAutoplay();
        }
    }

    renderBaseStructure() {
        this.container.innerHTML = `
            <div class="gallery-container">
                <div class="gallery-gradient gallery-gradient-left"></div>
                <div class="gallery-gradient gallery-gradient-right"></div>
                <div class="gallery-content">
                    <div class="gallery-track">
                        <!-- Gallery items will be injected here by renderGalleryItems -->
                    </div>
                </div>
            </div>
        `;
    }

    getElements() {
        this.elements.galleryTrack = this.container.querySelector('.gallery-track');
        this.elements.galleryContent = this.container.querySelector('.gallery-content');
    }

    attachEventListeners() {
        // Resize listener for responsive calculations
        window.addEventListener('resize', throttle(this.handleResize.bind(this), 100));

        // Drag listeners (unified for pointer events)
        this.elements.galleryTrack.addEventListener('pointerdown', this.handlePointerDown.bind(this));
        document.addEventListener('pointermove', this.handlePointerMove.bind(this));
        document.addEventListener('pointerup', this.handlePointerUp.bind(this));
        // Also handle pointercancel for robustness (e.g., if pointer leaves window)
        document.addEventListener('pointercancel', this.handlePointerUp.bind(this));


        // Hover listeners for autoplay
        if (this.options.autoplay && this.options.pauseOnHover) {
            this.elements.galleryTrack.addEventListener('mouseenter', this.handleMouseEnter.bind(this));
            this.elements.galleryTrack.addEventListener('mouseleave', this.handleMouseLeave.bind(this));
        }
    }

    handleResize() {
        const newIsScreenSizeSm = window.innerWidth <= this.options.smBreakpoint;
        if (this.isScreenSizeSm !== newIsScreenSizeSm) {
            this.isScreenSizeSm = newIsScreenSizeSm;
            this.renderGalleryItems(); // Re-render to apply new dimensions
            this.updateTransform(); // Reapply current rotation
        }
    }

    // --- Pointer (Mouse/Touch) Event Handlers ---

    handlePointerDown(e) {
        // Only respond to primary mouse button (left) or touch
        if (e.button !== 0 && !e.touches) return;

        this.isDragging = true;
        this.startX = e.clientX || e.touches[0].clientX;
        this.lastMoveX = this.startX; // Initialize for velocity calculation
        this.lastMoveTime = performance.now(); // Initialize for velocity calculation
        this.startRotation = this.rotationDegrees;
        this.currentVelocity = 0; // Reset velocity on new drag start

        // Stop any ongoing autoplay or flick animation
        this.stopAutoplay();
        this.cancelFlickAnimation();

        this.elements.galleryTrack.style.transition = 'none'; // Disable transition during drag
        this.elements.galleryTrack.style.cursor = 'grabbing';
        this.elements.galleryTrack.setPointerCapture(e.pointerId); // Capture pointer events
    }

    handlePointerMove(e) {
        if (!this.isDragging) return;

        e.preventDefault(); // Prevent default scroll/selection behavior (especially on touch devices)

        const currentX = e.clientX || e.touches[0].clientX;
        const currentTime = performance.now();

        const deltaX = currentX - this.startX;
        this.rotationDegrees = this.startRotation + deltaX * this.options.dragFactor;

        // Calculate instantaneous velocity for flick
        if (currentTime - this.lastMoveTime > 0) { // Avoid division by zero
            this.currentVelocity = (currentX - this.lastMoveX) / (currentTime - this.lastMoveTime) * 1000 * this.options.dragFactor; // px/ms -> px/s
        }

        this.lastMoveX = currentX;
        this.lastMoveTime = currentTime;

        this.updateTransform();
    }

    handlePointerUp(e) {
        if (!this.isDragging) return;
        this.isDragging = false;
        this.elements.galleryTrack.style.cursor = 'grab';
        this.elements.galleryTrack.releasePointerCapture(e.pointerId); // Release pointer capture

        // Start flick animation or restart autoplay
        if (Math.abs(this.currentVelocity) > this.options.flickMinVelocity) {
            this.startFlickAnimation();
        } else {
            // Snap to nearest face if velocity is too low
            this.snapToNearestFace();
            if (this.options.autoplay) {
                this.startAutoplay();
            }
        }
    }

    // --- Autoplay & Flick Animation Logic ---

    startAutoplay() {
        if (this.autoplayIntervalId) return; // Prevent multiple intervals

        this.elements.galleryTrack.style.transition = `transform ${this.options.autoplayRotationDuration / 1000}s linear`;

        this.autoplayIntervalId = setInterval(() => {
            const rotationPerFace = 360 / this.images.length;
            this.rotationDegrees -= rotationPerFace; // Rotate to the next image (counter-clockwise)
            this.updateTransform();
        }, this.options.autoplayIntervalMs);
    }

    stopAutoplay() {
        if (this.autoplayIntervalId) {
            clearInterval(this.autoplayIntervalId);
            this.autoplayIntervalId = null;
        }
    }

    handleMouseEnter() {
        if (this.options.pauseOnHover) {
            this.stopAutoplay();
        }
    }

    handleMouseLeave() {
        if (this.options.pauseOnHover && this.options.autoplay) {
            this.startAutoplay();
        }
    }

    startFlickAnimation() {
        this.cancelFlickAnimation(); // Cancel any existing animation

        const animate = () => {
            // Apply velocity to rotation
            this.rotationDegrees += this.currentVelocity;
            this.updateTransform();

            // Decay velocity
            this.currentVelocity *= this.options.flickDecay;

            // Continue animation if velocity is above threshold
            if (Math.abs(this.currentVelocity) > this.options.flickMinVelocity) {
                this.animationFrameId = requestAnimationFrame(animate);
            } else {
                // Snap to nearest face when velocity is too low
                this.snapToNearestFace();
                if (this.options.autoplay) {
                    this.startAutoplay();
                }
            }
        };

        this.animationFrameId = requestAnimationFrame(animate);
    }

    cancelFlickAnimation() {
        if (this.animationFrameId) {
            cancelAnimationFrame(this.animationFrameId);
            this.animationFrameId = null;
        }
    }

    snapToNearestFace() {
        const rotationPerFace = 360 / this.images.length;
        const normalizedRotation = this.rotationDegrees % 360;
        const nearestFaceIndex = Math.round(normalizedRotation / rotationPerFace);
        const targetRotation = nearestFaceIndex * rotationPerFace;

        // Apply smooth transition
        this.elements.galleryTrack.style.transition = 'transform 0.3s ease-out';
        this.rotationDegrees = targetRotation;
        this.updateTransform();

        // Reset transition after animation completes
        setTimeout(() => {
            if (!this.isDragging && !this.autoplayIntervalId) {
                this.elements.galleryTrack.style.transition = 'none';
            }
        }, 300);
    }

    // --- Rendering & Transform Logic ---

    renderGalleryItems() {
        // Clear existing items
        this.elements.galleryTrack.innerHTML = '';

        // Calculate dimensions based on screen size
        const faceWidth = this.isScreenSizeSm ? 150 : 350; // Width of each face (image + padding)
        const radius = (faceWidth / 2) / Math.tan(Math.PI / this.images.length); // Calculate radius based on face width and number of images

        // Set track width to match face width for proper centering
        this.elements.galleryTrack.style.width = `${faceWidth}px`;

        // Create and position items in a circle
        this.images.forEach((imageUrl, index) => {
            const item = document.createElement('div');
            item.className = 'gallery-item';

            const img = document.createElement('img');
            img.className = 'gallery-img';
            img.src = imageUrl;
            img.alt = `Gallery image ${index + 1}`;
            img.loading = 'lazy'; // Optimize loading

            item.appendChild(img);
            this.elements.galleryTrack.appendChild(item);

            // Calculate position in the circle
            const angle = (360 / this.images.length) * index;
            const radians = (angle * Math.PI) / 180;

            // Position using 3D transforms
            item.style.transform = `
                rotateY(${angle}deg) 
                translateZ(${radius}px) 
                scale(${this.options.gapFactor}) 
            `;
        });
    }

    updateTransform() {
        if (this.elements.galleryTrack) {
            this.elements.galleryTrack.style.transform = `rotateY(${this.rotationDegrees}deg)`;
        }
    }
}