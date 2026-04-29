# Troo Town Economic City Blueprint

**Hub-and-spoke layout for maximum economic activity, user flow, and business interactions.**

---

## 1. District Layout (Hub-and-Spoke)

```
            Innovation District (0, -80)
                   │
                   │
Creator (-60, -40) ┼── Consulting (60, -40)
                   │
                   │
           Central Plaza (0, 0) ← SPAWN
                   │
                   │
         Marketplace (0, 40)
                   │
                   │
           Education (0, 80)
```

**Coordinate system**: X = east/west, Z = north/south. Central Plaza at origin.

---

## 2. Platform Zone Slugs

| District | Slug | Purpose |
|----------|------|---------|
| Central Plaza | `central_plaza` | Platform HQ, onboarding, spawn, events |
| Consulting District | `consulting_district` | Service businesses, consultations |
| Creator District | `creator_district` | Digital creators, templates, agents |
| Marketplace District | `marketplace_district` | Asset exchange, highest transaction area |
| Innovation District | `innovation_district` | Developers, API, automation |
| Education District | `education_district` | Academy, training, mentorship |

---

## 3. Zone Bounds (boundsJson)

Each zone reserves space. Format: `{ centerX, centerZ, width, length, heightLimit }`.

| Zone | centerX | centerZ | width | length |
|------|---------|---------|-------|--------|
| central_plaza | 0 | 0 | 48 | 48 |
| consulting_district | 60 | -40 | 40 | 40 |
| creator_district | -60 | -40 | 40 | 40 |
| marketplace_district | 0 | 40 | 48 | 40 |
| innovation_district | 0 | -80 | 40 | 40 |
| education_district | 0 | 80 | 40 | 48 |

---

## 4. Central Plaza (Platform HQ)

**Spawn point**: (0, 0, 0)

| Building | Position (x, y, z) | Function |
|----------|-------------------|----------|
| Welcome Center | (0, 0, 0) | Onboarding, tutorials |
| Platform HQ Tower | (0, 0, -8) | Support, ecosystem overview |
| Event Arena | (12, 0, 0) | Launches, AMAs |
| Featured Creator Tower | (-12, 0, 0) | Promoted businesses |
| Digital Billboards | (±20, 2, ±15) | Admin-controlled ads |

**placementsJson** (example):
```json
[
  { "id": "welcome_center", "assetId": "welcome_center", "position": [0, 0, 0], "rotation": [0, 0, 0], "scale": [1, 1, 1] },
  { "id": "platform_hq", "assetId": "troothhertz_tower", "position": [0, 0, -8], "rotation": [0, 0, 0], "scale": [1, 1, 1] },
  { "id": "event_arena", "assetId": "event_stage", "position": [12, 0, 0], "rotation": [0, 0, 0], "scale": [1, 1, 1] }
]
```

---

## 5. Consulting District

**Position**: East of center (60, -40)

| Building | Function |
|----------|----------|
| Grant Writing Agency | Consultation desks |
| Marketing Agency | Service kiosks |
| Legal/Financial Consulting | AI assistant terminals |
| Meeting Rooms | Book consultations |

**Commerce nodes**: book consultations, purchase services, start projects.

---

## 6. Creator District

**Position**: West of center (-60, -40)

| Building | Function |
|----------|----------|
| Creator Studios | Design labs |
| Asset Marketplace | Template stores |
| AI Agent Showroom | Agent demos |

**Commerce nodes**: AI agents, BIB templates, world assets.

---

## 7. Marketplace District

**Position**: South of center (0, 40)

**Highest transaction area.** Neon market streets, vendor booths.

| Building | Function |
|----------|----------|
| Asset Exchange | Digital asset trading |
| AI Agent Marketplace | Agent purchase |
| Template Marketplace | BIB templates |
| Token Exchange | TROO token |

**Commerce density**: Every 30–50m = interaction point.

---

## 8. Innovation District

**Position**: North of center (0, -80)

| Building | Function |
|----------|----------|
| Developer Labs | API integration |
| Automation Studios | Workflow builders |
| Startup Incubator | New ventures |

Connects to developer ecosystem, event registry, webhooks.

---

## 9. Education District

**Position**: Far south (0, 80)

| Building | Function |
|----------|----------|
| Academy Tower | Courses |
| Training Centers | Workshops |
| Mentorship Offices | 1:1 guidance |

---

## 10. User Flow

```
Spawn (Central Plaza)
    ↓
Education District (learn)
    ↓
Marketplace District (buy tools)
    ↓
Creator District (build assets)
    ↓
Consulting District (sell services)
```

**Traffic loop**: Marketplace → Creator → Consulting → Marketplace

---

## 11. Commerce Density Rule

**Every 30–50 meters = interaction point**

Interaction points:
- AI agents
- Kiosks
- Service desks
- Meeting rooms
- Asset shops

---

## 12. Vertical Building Strategy

| Floor | Purpose |
|-------|---------|
| Lobby | Reception, lead intake |
| Floor 2 | Consultation rooms |
| Floor 3 | AI agent operations |
| Floor 4 | Meeting rooms |
| Rooftop | Events |

---

## 13. World Links (Portals)

Use `world_links` for district-to-district fast travel:

| From | To | Label |
|------|-----|-------|
| central_plaza | marketplace_district | → Marketplace |
| central_plaza | consulting_district | → Consulting |
| central_plaza | creator_district | → Creator |
| central_plaza | education_district | → Academy |
| central_plaza | innovation_district | → Innovation |

**Transit time**: ~5 seconds (portal teleport).

---

## 14. Implementation Checklist

### Database
- [ ] Create `platform_global_zones` rows for each district (or use existing zone system)
- [ ] Add `boundsJson` per zone
- [ ] Add `placementsJson` with building positions
- [ ] Seed commerce nodes in each district

### Spawn Point
- [ ] Set default camera/player spawn to (0, 0, 0) in Central Plaza
- [ ] World viewer: initial camera position

### Commerce Nodes
- [ ] Place commerce nodes in Consulting District (consultation, service)
- [ ] Place commerce nodes in Creator District (agents, templates)
- [ ] Place commerce nodes in Marketplace District (assets, tokens)
- [ ] Ensure 30–50m spacing

### Activity Layer
- [ ] Activity feed shows district context
- [ ] Commerce node glow + pulse already implemented

### Future
- [ ] District portals (world_links between zone areas)
- [ ] Floating world map
- [ ] Transit pods / hover taxis
- [ ] Multi-city expansion (Creator City, Finance City, etc.)

---

## 15. Schema Compatibility

Existing tables support this blueprint:

| Table | Use |
|-------|-----|
| `platform_global_zones` | One row per district (slug, boundsJson, placementsJson) |
| `world_commerce_nodes` | Commerce nodes in each district |
| `world_links` | Portals between districts (or between worlds) |
| `platform_activity` | Activity stream for economic signals |

---

*Last updated: March 2026*
