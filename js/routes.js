document.addEventListener("DOMContentLoaded", function() {
    const sitePrefix = getSitePrefix();
    const routeCsvUrl = sitePrefix + "routes.csv";
    const mapElement = document.getElementById("route-map");
    const routeSectionsElement = document.getElementById("map-routes");
    const routeStatusElement = document.getElementById("route-status");
    const showAllButton = document.getElementById("show-all-routes");
    const hideAllButton = document.getElementById("hide-all-routes");
    const togglePoisButton = document.getElementById("toggle-route-pois");
    const hasLeaflet = typeof L !== "undefined";
    const activeRouteIds = new Set();
    const routeLayers = new Map();
    const routeElements = new Map();
    const routeColors = ["#0b5f0b", "#d97706", "#2563eb", "#b91c1c", "#7c3aed", "#047857", "#be123c"];
    let map = null;
    let poiLayer = null;
    let routes = [];

    const pointsOfInterest = [
        {
            name: "Forest Hills Bike Rotary",
            description: "Monday and Saturday meetup spot",
            coordinates: [42.30172, -71.11382]
        },
        {
            name: "Downes Field Track",
            description: "Thursday track night meetup spot",
            coordinates: [42.32313, -71.11605]
        },
        {
            name: "J.P. Licks",
            description: "Common Saturday post-run finish",
            coordinates: [42.31481, -71.11403]
        }
    ];

    if (!mapElement || !routeSectionsElement) {
        return;
    }

    initializeMap();
    loadRoutes();

    if (showAllButton) {
        showAllButton.addEventListener("click", function() {
            Promise.all(routes.map(function(route) {
                return setRouteActive(route, true, false);
            })).then(function() {
                fitActiveRoutes();
                renderFallbackRoutes();
                updateRouteStatus(`${activeRouteIds.size} routes selected`);
            });
        });
    }

    if (hideAllButton) {
        hideAllButton.addEventListener("click", function() {
            routes.forEach(function(route) {
                setRouteActive(route, false);
            });
            updateRouteStatus("No routes selected");
        });
    }

    if (togglePoisButton) {
        togglePoisButton.addEventListener("click", function() {
            togglePointsOfInterest();
        });
    }

    function getSitePrefix() {
        return window.location.pathname.indexOf("/routes/") !== -1 ? "../" : "";
    }

    function initializeMap() {
        if (!hasLeaflet) {
            mapElement.classList.add("route-map-fallback");
            mapElement.innerHTML = '<svg class="route-fallback-svg" role="img" aria-label="Selected route preview"></svg>';
            updateRouteStatus("Select a route below to preview it on the map");
            return;
        }

        map = L.map(mapElement, {
            scrollWheelZoom: false,
            center: [42.3098, -71.1146],
            zoom: 13
        });

        L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
            maxZoom: 19,
            attribution: "&copy; OpenStreetMap contributors"
        }).addTo(map);

        poiLayer = L.layerGroup(pointsOfInterest.map(function(poi) {
            return L.circleMarker(poi.coordinates, {
                radius: 7,
                color: "#092409",
                fillColor: "#ffd700",
                fillOpacity: 0.9,
                weight: 2
            }).bindPopup(`<strong>${escapeHtml(poi.name)}</strong><br>${escapeHtml(poi.description)}`);
        })).addTo(map);
    }

    function loadRoutes() {
        fetch(routeCsvUrl)
            .then(function(response) {
                if (!response.ok) {
                    throw new Error("Could not load " + routeCsvUrl);
                }
                return response.text();
            })
            .then(function(csvText) {
                routes = parseRouteCsv(csvText).map(function(route, index) {
                    route.color = routeColors[index % routeColors.length];
                    return route;
                });
                renderRouteSections(routes);
                updateRouteStatus(`${routes.length} routes loaded`);
            })
            .catch(function(error) {
                console.error("Error loading routes:", error);
                updateRouteStatus("Routes could not be loaded. Check routes.csv and the GPX files.");
            });
    }

    function parseRouteCsv(csvText) {
        const rows = parseDelimitedRows(csvText.trim(), "|");
        const headers = rows.shift().map(function(header) {
            return header.trim();
        });

        return rows
            .filter(function(row) {
                return row.some(function(cell) {
                    return cell.trim() !== "";
                });
            })
            .map(function(row) {
                const route = {};

                headers.forEach(function(header, index) {
                    route[header] = (row[index] || "").trim();
                });

                route.categories = splitList(route.categories);
                route.gpxUrl = resolveAssetPath(route.gpx);
                route.stravaUrl = route.strava_url || "";
                route.mapUrl = route.map_url || "";
                route.section = route.section || "Routes";
                return route;
            });
    }

    function parseDelimitedRows(text, delimiter) {
        const rows = [];
        let row = [];
        let cell = "";
        let inQuotes = false;

        for (let index = 0; index < text.length; index += 1) {
            const character = text[index];
            const nextCharacter = text[index + 1];

            if (character === '"' && nextCharacter === '"') {
                cell += '"';
                index += 1;
            } else if (character === '"') {
                inQuotes = !inQuotes;
            } else if (character === delimiter && !inQuotes) {
                row.push(cell);
                cell = "";
            } else if ((character === "\n" || character === "\r") && !inQuotes) {
                if (character === "\r" && nextCharacter === "\n") {
                    index += 1;
                }
                row.push(cell);
                rows.push(row);
                row = [];
                cell = "";
            } else {
                cell += character;
            }
        }

        row.push(cell);
        rows.push(row);
        return rows;
    }

    function splitList(value) {
        return (value || "")
            .split(";")
            .map(function(item) {
                return item.trim();
            })
            .filter(Boolean);
    }

    function resolveAssetPath(path) {
        if (!path || path.indexOf("http://") === 0 || path.indexOf("https://") === 0 || path.indexOf("/") === 0) {
            return path;
        }

        return sitePrefix + path.replace(/^\.\//, "");
    }

    function renderRouteSections(routeData) {
        routeSectionsElement.innerHTML = "";
        routeElements.clear();

        const groupedRoutes = routeData.reduce(function(groups, route) {
            if (!groups[route.section]) {
                groups[route.section] = [];
            }
            groups[route.section].push(route);
            return groups;
        }, {});

        Object.keys(groupedRoutes).forEach(function(sectionName) {
            const section = document.createElement("section");
            section.className = "route-section";

            const heading = document.createElement("button");
            heading.type = "button";
            heading.className = "route-section-heading";
            heading.setAttribute("aria-expanded", "true");
            heading.textContent = sectionName;

            const list = document.createElement("div");
            list.className = "route-section-list";

            groupedRoutes[sectionName].forEach(function(route) {
                list.appendChild(createRouteEntry(route));
            });

            heading.addEventListener("click", function() {
                const isExpanded = heading.getAttribute("aria-expanded") === "true";
                heading.setAttribute("aria-expanded", isExpanded ? "false" : "true");
                list.hidden = isExpanded;
            });

            section.appendChild(heading);
            section.appendChild(list);
            routeSectionsElement.appendChild(section);
        });
    }

    function createRouteEntry(route) {
        const item = document.createElement("div");
        item.className = "route-entry";
        item.dataset.routeId = route.id;

        const button = document.createElement("button");
        button.type = "button";
        button.className = "routename";
        button.textContent = routeTitle(route);

        const description = document.createElement("span");
        description.className = "route-description";
        description.id = "desc-" + route.id;
        description.hidden = true;

        const descriptionText = document.createElement("span");
        descriptionText.textContent = route.description;
        description.appendChild(descriptionText);

        const meta = document.createElement("span");
        meta.className = "route-meta";
        meta.textContent = routeMeta(route);
        description.appendChild(meta);

        const links = createRouteLinks(route);
        if (links.childNodes.length > 0) {
            description.appendChild(links);
        }

        button.addEventListener("click", function() {
            setRouteActive(route, !activeRouteIds.has(route.id));
        });

        item.appendChild(button);
        item.appendChild(description);
        routeElements.set(route.id, { item: item, description: description, button: button });
        return item;
    }

    function routeTitle(route) {
        const details = [route.distance, route.elevation].filter(Boolean).join(", ");
        return details ? `${route.name} (${details})` : route.name;
    }

    function routeMeta(route) {
        const meta = [route.vibe, route.start ? "Start: " + route.start : "", route.end ? "End: " + route.end : ""]
            .filter(Boolean)
            .join(" | ");
        return meta ? " " + meta : "";
    }

    function createRouteLinks(route) {
        const links = document.createElement("span");
        links.className = "route-links";

        if (route.stravaUrl) {
            links.appendChild(createLink("Strava Route", route.stravaUrl, false));
        }

        if (route.gpxUrl) {
            links.appendChild(createLink("gpx", route.gpxUrl, true));
        }

        if (route.mapUrl) {
            links.appendChild(createLink("Meetup map", route.mapUrl, false));
        }

        return links;
    }

    function createLink(label, url, isDownload) {
        const link = document.createElement("a");
        link.href = url;
        link.textContent = label;

        if (isDownload) {
            link.setAttribute("download", "");
        } else {
            link.target = "_blank";
            link.rel = "noopener";
        }

        return link;
    }

    function setRouteActive(route, shouldActivate, shouldFit) {
        const elements = routeElements.get(route.id);
        const shouldFitRoute = shouldFit !== false;

        if (!shouldActivate) {
            activeRouteIds.delete(route.id);

            if (hasLeaflet && routeLayers.has(route.id)) {
                map.removeLayer(routeLayers.get(route.id));
            }

            if (elements) {
                elements.item.classList.remove("selected");
                elements.description.hidden = true;
            }

            renderFallbackRoutes();
            updateRouteStatusFromActiveRoutes();
            return Promise.resolve();
        }

        return loadRouteLayer(route)
            .then(function(layer) {
                activeRouteIds.add(route.id);

                if (hasLeaflet && layer && !map.hasLayer(layer)) {
                    layer.addTo(map);
                    layer.bringToFront();
                }

                if (hasLeaflet && layer && shouldFitRoute) {
                    map.fitBounds(layer.getBounds(), {
                        padding: [28, 28],
                        maxZoom: 15
                    });
                }

                if (elements) {
                    elements.item.classList.add("selected");
                    elements.description.hidden = false;
                }

                renderFallbackRoutes();
                updateRouteStatusFromActiveRoutes(route.name);
            })
            .catch(function(error) {
                console.error("Error loading route:", error);
                updateRouteStatus(`Could not load ${route.name}. Check the GPX path in routes.csv.`);
            });
    }

    function loadRouteLayer(route) {
        if (routeLayers.has(route.id)) {
            return Promise.resolve(routeLayers.get(route.id));
        }

        if (!hasLeaflet && route.coordinates) {
            return Promise.resolve(null);
        }

        if (!route.gpxUrl) {
            return Promise.reject(new Error("Missing GPX URL for " + route.id));
        }

        return fetch(route.gpxUrl)
            .then(function(response) {
                if (!response.ok) {
                    throw new Error("Could not load " + route.gpxUrl);
                }
                return response.text();
            })
            .then(function(gpxText) {
                const coordinates = parseGpxCoordinates(gpxText);
                route.coordinates = coordinates;

                if (!hasLeaflet) {
                    return null;
                }

                const layer = L.polyline(coordinates, {
                    color: route.color,
                    weight: 5,
                    opacity: 0.9
                }).bindTooltip(route.name, {
                    sticky: true
                });

                routeLayers.set(route.id, layer);
                return layer;
            });
    }

    function fitActiveRoutes() {
        if (!hasLeaflet) {
            return;
        }

        const bounds = L.latLngBounds([]);

        activeRouteIds.forEach(function(routeId) {
            const layer = routeLayers.get(routeId);
            if (layer) {
                bounds.extend(layer.getBounds());
            }
        });

        if (bounds.isValid()) {
            map.fitBounds(bounds, {
                padding: [28, 28],
                maxZoom: 14
            });
        }
    }

    function parseGpxCoordinates(gpxText) {
        const gpxDocument = new DOMParser().parseFromString(gpxText, "application/xml");
        const parserError = gpxDocument.querySelector("parsererror");

        if (parserError) {
            throw new Error("Invalid GPX file");
        }

        const points = Array.from(gpxDocument.querySelectorAll("trkpt, rtept"))
            .map(function(point) {
                return [
                    parseFloat(point.getAttribute("lat")),
                    parseFloat(point.getAttribute("lon"))
                ];
            })
            .filter(function(point) {
                return Number.isFinite(point[0]) && Number.isFinite(point[1]);
            });

        if (points.length < 2) {
            throw new Error("GPX file needs at least two points");
        }

        return points;
    }

    function renderFallbackRoutes() {
        if (hasLeaflet) {
            return;
        }

        const svg = mapElement.querySelector(".route-fallback-svg");
        if (!svg) {
            return;
        }

        const activeRoutes = routes.filter(function(route) {
            return activeRouteIds.has(route.id) && route.coordinates;
        });

        svg.innerHTML = "";

        if (activeRoutes.length === 0) {
            svg.setAttribute("viewBox", "0 0 100 100");
            return;
        }

        const points = activeRoutes.flatMap(function(route) {
            return route.coordinates;
        });
        const bounds = coordinateBounds(points);
        const width = 1000;
        const height = 560;
        const padding = 42;
        svg.setAttribute("viewBox", `0 0 ${width} ${height}`);

        activeRoutes.forEach(function(route) {
            const polyline = document.createElementNS("http://www.w3.org/2000/svg", "polyline");
            polyline.setAttribute("fill", "none");
            polyline.setAttribute("stroke", route.color);
            polyline.setAttribute("stroke-width", "9");
            polyline.setAttribute("stroke-linecap", "round");
            polyline.setAttribute("stroke-linejoin", "round");
            polyline.setAttribute("points", route.coordinates.map(function(point) {
                return projectPoint(point, bounds, width, height, padding).join(",");
            }).join(" "));
            svg.appendChild(polyline);
        });
    }

    function coordinateBounds(points) {
        return points.reduce(function(bounds, point) {
            return {
                minLat: Math.min(bounds.minLat, point[0]),
                maxLat: Math.max(bounds.maxLat, point[0]),
                minLng: Math.min(bounds.minLng, point[1]),
                maxLng: Math.max(bounds.maxLng, point[1])
            };
        }, {
            minLat: Infinity,
            maxLat: -Infinity,
            minLng: Infinity,
            maxLng: -Infinity
        });
    }

    function projectPoint(point, bounds, width, height, padding) {
        const latRange = bounds.maxLat - bounds.minLat || 1;
        const lngRange = bounds.maxLng - bounds.minLng || 1;
        const x = padding + ((point[1] - bounds.minLng) / lngRange) * (width - padding * 2);
        const y = padding + ((bounds.maxLat - point[0]) / latRange) * (height - padding * 2);
        return [Math.round(x), Math.round(y)];
    }

    function togglePointsOfInterest() {
        if (!hasLeaflet || !poiLayer) {
            mapElement.classList.toggle("hide-route-pois");
            return;
        }

        if (map.hasLayer(poiLayer)) {
            map.removeLayer(poiLayer);
        } else {
            poiLayer.addTo(map);
        }
    }

    function updateRouteStatusFromActiveRoutes(routeName) {
        if (activeRouteIds.size === 0) {
            updateRouteStatus("No routes selected");
        } else if (routeName) {
            updateRouteStatus(routeName);
        } else {
            updateRouteStatus(`${activeRouteIds.size} routes selected`);
        }
    }

    function updateRouteStatus(message) {
        if (routeStatusElement) {
            routeStatusElement.textContent = message;
        }
    }

    function escapeHtml(value) {
        const element = document.createElement("span");
        element.textContent = value;
        return element.innerHTML;
    }
});
