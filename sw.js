const CACHE_NAME = 'fractured-city-v20';
const ASSETS = [
    '/',
    '/index.html',
    '/styles.css',
    '/manifest.json',
    '/src/main.js',
    '/src/core/Game.js',
    '/src/core/Renderer.js',
    '/src/core/SpriteManager.js',
    '/assets/walls/walls.png',
    '/assets/objects/objects.png',
    '/assets/entites/player_characters/player_characers.png',
    '/assets/entites/npcs/npc.png',
    '/src/core/InputHandler.js',
    '/src/world/World.js',
    '/src/world/Chunk.js',
    '/src/world/WorldObject.js',
    '/src/world/ExtractionPoint.js',
    '/src/world/objects/Door.js',
    '/src/world/objects/Furniture.js',
    '/src/entities/Entity.js',
    '/src/entities/Player.js',
    '/src/entities/NPC.js',
    '/src/entities/Anatomy.js',
    '/src/systems/EquipmentSystem.js',
    '/src/systems/FoVSystem.js',
    '/src/systems/SoundSystem.js',
    '/src/systems/ItemSystem.js',
    '/src/systems/ContainerSystem.js',
    '/src/systems/CharacterCreationSystem.js',
    '/src/systems/CraftingSystem.js',
    '/src/systems/CombatSystem.js',
    '/src/systems/CombatEffects.js',
    '/src/systems/WorldObjectSystem.js',
    '/src/systems/TimeSystem.js',
    '/src/systems/LightingSystem.js',
    '/src/content/ContentManager.js',
    '/src/content/BuildingPrefabs.js',
    '/src/content/LootTables.js',
    '/src/ui/UIManager.js',
    '/src/ui/CraftingUI.js',
    '/src/ui/DisassembleModal.js',
    '/src/ui/WorldObjectModal.js',
    '/src/ui/MobileControls.js'
];

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            return cache.addAll(ASSETS);
        })
    );
    self.skipWaiting();
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((keys) => {
            return Promise.all(
                keys.filter((key) => key !== CACHE_NAME)
                    .map((key) => caches.delete(key))
            );
        })
    );
    self.clients.claim();
});

self.addEventListener('fetch', (event) => {
    event.respondWith(
        caches.match(event.request).then((cached) => {
            return cached || fetch(event.request).then((response) => {
                // Cache new requests dynamically
                if (response.status === 200) {
                    const clone = response.clone();
                    caches.open(CACHE_NAME).then((cache) => {
                        cache.put(event.request, clone);
                    });
                }
                return response;
            });
        }).catch(() => {
            // Fallback for offline
            if (event.request.mode === 'navigate') {
                return caches.match('/index.html');
            }
        })
    );
});
