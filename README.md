# Rolling Gallery

A 3D rolling image gallery with autoplay and interactive features. This gallery displays images in a 3D carousel that can be controlled via mouse/touch interaction or set to autoplay.

## Features

- 3D rotating gallery with smooth animations
- Autoplay with configurable speed
- Pause on hover functionality
- Interactive dragging and flicking
- Responsive design that adapts to different screen sizes
- Gradient overlays for smooth visual transitions
- Customizable options

## Usage

1. Include the required files:

```html
<link rel="stylesheet" href="style.css">
<script src="script.js"></script>
```

2. Create a container element:

```html
<div id="gallery-app"></div>
```

3. Initialize the gallery:

```javascript
const IMAGES = [
    "image1.jpg",
    "image2.jpg",
    // Add more image URLs
];

document.addEventListener('DOMContentLoaded', () => {
    const galleryContainer = document.getElementById('gallery-app');
    new RollingGallery(galleryContainer, {
        images: IMAGES,
        autoplay: true,
        pauseOnHover: true,
        smBreakpoint: 640 // Defines what 'sm' screen size means
    });
});
```

## Configuration Options

- `images`: Array of image URLs to display
- `autoplay`: Boolean to enable/disable autoplay (default: false)
- `pauseOnHover`: Boolean to pause autoplay on hover (default: false)
- `smBreakpoint`: Number defining the small screen breakpoint in pixels (default: 640)
- `autoplayIntervalMs`: Time between autoplay rotations in milliseconds (default: 4000)
- `autoplayRotationDuration`: Duration of autoplay rotation animation in milliseconds (default: 3000)
- `dragFactor`: Multiplier for drag sensitivity (default: 0.05)
- `flickDecay`: How fast flick velocity decays (default: 0.92)
- `flickMinVelocity`: Minimum velocity to continue flick animation (default: 0.1)
- `gapFactor`: Multiplier for face width to create gaps between images (default: 0.95)

## License

This project is based on a CodePen by [Mozo Joy](https://codepen.io/Mozo-Joy) and is licensed under the [CodePen License](https://codepen.io/license/pen/raOGYzQ).