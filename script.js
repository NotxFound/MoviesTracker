const IMAGE_BASE_URL = 'https://image.tmdb.org/t/p/w500';
const BACKDROP_BASE_URL = 'https://image.tmdb.org/t/p/w1280';

const searchInput = document.getElementById('searchInput');
const clearBtn = document.getElementById('clearBtn');
const watchlistGrid = document.getElementById('watchlistGrid');
const watchlistCount = document.getElementById('watchlistCount');
const detailsModal = document.getElementById('detailsModal');
const modalContent = document.getElementById('modalContent');
const settingsModal = document.getElementById('settingsModal');
const settingsModalContent = document.getElementById('settingsModalContent');
const toast = document.getElementById('toast');
const filterBtns = document.querySelectorAll('.filter-btn');
const searchDropdown = document.getElementById('searchDropdown');
const searchDropdownResults = document.getElementById('searchDropdownResults');
const loadingDropdown = document.getElementById('loadingDropdown');

let currentFilter = 'all';
let watchlist = JSON.parse(localStorage.getItem('watchlist')) || [];
let searchTimeout = null;
let currentTVShow = null;

function setupEventListeners() {
    searchInput.addEventListener('input', function () {
        const query = this.value.trim();
        if (searchTimeout) clearTimeout(searchTimeout);
        if (!query) {
            hideSearchDropdown();
            return;
        }
        searchTimeout = setTimeout(() => performSearch(query), 300);
    });

    searchInput.addEventListener('focus', function () {
        if (this.value.trim() && searchDropdownResults.innerHTML) {
            showSearchDropdown();
        }
    });

    clearBtn.addEventListener('click', function () {
        searchInput.value = '';
        hideSearchDropdown();
        searchInput.focus();
        if (searchTimeout) clearTimeout(searchTimeout);
    });

    filterBtns.forEach(btn => {
        btn.addEventListener('click', function () {
            filterBtns.forEach(b => b.classList.remove('active'));
            this.classList.add('active');
            currentFilter = this.dataset.type;
            const query = searchInput.value.trim();
            if (query && !searchDropdown.classList.contains('hidden')) {
                performSearch(query);
            }
        });
    });

    detailsModal.addEventListener('click', e => {
        if (e.target === detailsModal) closeModal();
    });

    document.addEventListener('click', e => {
        const searchSection = document.querySelector('.search-section');
        const isClickInsideSearch = searchSection && searchSection.contains(e.target);
        const isClickOnModal = detailsModal.contains(e.target) || settingsModal.contains(e.target);
        const isClickOnToast = toast.contains(e.target);

        if (!isClickInsideSearch && !isClickOnModal && !isClickOnToast && !searchDropdown.classList.contains('hidden')) {
            hideSearchDropdown();
        }
    });

    document.addEventListener('keydown', e => {
        if (e.key === 'Escape') hideSearchDropdown();
    });
}

async function performSearch(query = null) {
    const searchQuery = query || searchInput.value.trim();
    if (!searchQuery) {
        hideSearchDropdown();
        return;
    }

    showDropdownLoading(true);
    searchDropdownResults.innerHTML = '';
    showSearchDropdown();

    try {
        let results = [];
        if (currentFilter === 'all') {
            const [movieResults, tvResults] = await Promise.all([
                searchMovies(searchQuery),
                searchTV(searchQuery)
            ]);
            results = [...movieResults, ...tvResults];
        } else if (currentFilter === 'movie') {
            results = await searchMovies(searchQuery);
        } else if (currentFilter === 'tv') {
            results = await searchTV(searchQuery);
        }

        results.sort((a, b) => (b.popularity || 0) - (a.popularity || 0));
        displayDropdownResults(results.slice(0, 20));
    } catch (error) {
        console.error('Błąd wyszukiwania:', error);
        showToast('Błąd podczas wyszukiwania', 'error');
        hideSearchDropdown();
    } finally {
        showDropdownLoading(false);
    }
}

async function searchMovies(query) {
    const res = await fetch(`/api/tmdb?action=search&type=movie&query=${encodeURIComponent(query)}`);
    const data = await res.json();
    return data.results.map(item => ({ ...item, media_type: 'movie' }));
}

async function searchTV(query) {
    const res = await fetch(`/api/tmdb?action=search&type=tv&query=${encodeURIComponent(query)}`);
    const data = await res.json();
    return data.results.map(item => ({ ...item, media_type: 'tv' }));
}

async function getMediaDetails(id, mediaType) {
    const res = await fetch(`/api/tmdb?action=details&type=${mediaType}&id=${id}`);
    return await res.json();
}

async function getTVDetails(id) {
    const res = await fetch(`/api/tmdb?action=tv&id=${id}`);
    return await res.json();
}

async function getTVSeasonDetails(id, season) {
    const res = await fetch(`/api/tmdb?action=tv&id=${id}&season=${season}`);
    return await res.json();
}

function displayDropdownResults(results) {
    if (results.length === 0) {
        searchDropdownResults.innerHTML = '<div class="search-dropdown-item"><div class="search-dropdown-info"><div class="search-dropdown-title">Nie znaleziono wyników</div></div></div>';
        return;
    }

    searchDropdownResults.innerHTML = results.map(item => createDropdownItem(item)).join('');
}

function createDropdownItem(item) {
    const title = item.title || item.name;
    const releaseDate = item.release_date || item.first_air_date;
    const year = releaseDate ? new Date(releaseDate).getFullYear() : '';
    const mediaType = item.media_type;
    const posterPath = item.poster_path ? `${IMAGE_BASE_URL}${item.poster_path}` : null;
    const isInWatchlist = watchlist.some(w => w.id === item.id && w.media_type === mediaType);

    return `
        <div class="search-dropdown-item">
            <div class="search-dropdown-image ${!posterPath ? 'no-image' : ''}" onclick="selectSearchResult(${item.id}, '${mediaType}')">
                ${posterPath ?
            `<img src="${posterPath}" alt="${title}" loading="lazy">` :
            `<i class="fas ${mediaType === 'movie' ? 'fa-film' : 'fa-tv'}"></i>`
        }
            </div>
            <div class="search-dropdown-info" onclick="selectSearchResult(${item.id}, '${mediaType}')">
                <div class="search-dropdown-title">${title}</div>
                <div class="search-dropdown-meta">
                    <span class="search-dropdown-type">${mediaType === 'movie' ? 'Film' : 'Serial'}</span>
                    ${year ? `<span class="search-dropdown-year">${year}</span>` : ''}
                </div>
            </div>
            <div class="search-dropdown-actions">
                <button class="dropdown-add-btn ${isInWatchlist ? 'added' : ''}" 
                        onclick="event.stopPropagation(); ${isInWatchlist ? '' : `addToWatchlistFromDropdown(${item.id}, '${mediaType}')`}"
                        title="${isInWatchlist ? 'W watchliście' : 'Dodaj do watchlisty'}">
                    <i class="fas ${isInWatchlist ? 'fa-check' : 'fa-plus'}"></i>
                </button>
            </div>
        </div>
    `;
}

function selectSearchResult(id, mediaType) {
    showDetails(id, mediaType);
}

async function addToWatchlistFromDropdown(id, mediaType) {
    try {
        await addToWatchlist(id, mediaType);
        if (searchInput.value.trim()) {
            performSearch();
        }
    } catch (error) {
        console.error('Błąd dodawania do watchlisty:', error);
    }
}

function showSearchDropdown() {
    searchDropdown.classList.remove('hidden');
}

function hideSearchDropdown() {
    searchDropdown.classList.add('hidden');
}

function showDropdownLoading(show) {
    if (show) {
        loadingDropdown.classList.remove('hidden');
        searchDropdownResults.innerHTML = '';
    } else {
        loadingDropdown.classList.add('hidden');
    }
}

function createMediaCard(item, isWatchlist = false) {
    const title = item.title || item.name;
    const releaseDate = item.release_date || item.first_air_date;
    const mediaType = item.media_type;

    const posterPath = item.poster_path ? `${IMAGE_BASE_URL}${item.poster_path}` : null;
    const hasImage = !!posterPath;

    const isInWatchlist = watchlist.some(w => w.id === item.id && w.media_type === mediaType);

    let episodeInfo = '';
    let missedEpisodesInfo = '';
    let movieInfo = '';

    if (isWatchlist && mediaType === 'tv') {
        episodeInfo = `<div class="card-episode">
           ${getLatestEpisodeInfo(item)}
        </div>`;

        if (item.lastViewedSeason && item.lastViewedEpisode) {
            const missedData = calculateMissedEpisodes(item, item.seasons);
            if (missedData.count > 0) {
                missedEpisodesInfo = `<div class="card-status">
                    <span class="episode-missed"><i class="fas fa-exclamation-triangle"></i>
                    ${missedData.count} odc. do obejrzenia! </span>
                </div> `;
            } else {
                missedEpisodesInfo = `<div class="card-status">
                        <span class="episode-current"><i class="fas fa-check-circle"></i> Jesteś na bieżąco! </span>
                </div> `;
            }
        }
    }

    if (isWatchlist && mediaType === 'movie') {
        let movieInfoParts = [];

        // Runtime only
        if (item.runtime) {
            const hours = Math.floor(item.runtime / 60);
            const minutes = item.runtime % 60;
            const duration = hours > 0 ? `${hours}h ${minutes}min` : `${minutes}min`;
            movieInfoParts.push(`<span class="movie-duration"><i class="fas fa-clock"></i> ${duration}</span>`);
        }

        if (movieInfoParts.length > 0) {
            movieInfo = `<div class="card-episode movie-info">
                ${movieInfoParts.join('')}
            </div>`;
        }

        // Watch status
        const isWatched = item.watched || false;
        missedEpisodesInfo = `<div class="card-status movie-status">
            ${isWatched ?
                `<span class="movie-watched"><i class="fas fa-check-circle"></i> Obejrzany</span>` :
                `<span class="movie-unwatched"><i class="fas fa-eye"></i> Do obejrzenia</span>`
            }
        </div>`;
    }

    return `
                    <div class="media-card" data-id="${item.id}" data-type="${mediaType}">
            <div class="card-image ${!hasImage ? 'no-image' : ''}">
                ${hasImage ?
            `<img src="${posterPath}" alt="${title}" loading="lazy" onerror="this.parentElement.classList.add('no-image'); this.style.display='none';">` :
            ''
        }
                <div class="card-placeholder ${hasImage ? 'hidden' : ''}">
                    <i class="fas ${mediaType === 'movie' ? 'fa-film' : 'fa-tv'}"></i>
                    <span>${title}</span>
                </div>
                <div class="card-date">
                    <i class="fas fa-calendar"></i>
                    ${releaseDate ? new Date(releaseDate).getFullYear() : 'Brak daty'}
                </div>
                <div class="card-type">
                    <i class="fas ${mediaType === 'movie' ? 'fa-film' : 'fa-tv'}"></i>
                    ${mediaType === 'movie' ? 'Film' : 'Serial'}
                </div>
            </div>
            <div class="card-content">
                <div class="card-info">
                    <h3 class="card-title">${title}</h3>
                    ${episodeInfo}
                    ${movieInfo}
                    ${missedEpisodesInfo}
                </div>
                <div class="card-actions">
                    ${isWatchlist ?
            `<button class="btn btn-danger" onclick="(function(e){ e.stopPropagation(); removeFromWatchlist(${item.id}, '${mediaType}', '${escapeStringForOnclick(title)}'); })(event)" title="Usuń z watchlisty">
                            <i class="fas fa-trash"></i>
                        </button>
                        ${mediaType === 'tv' ?
                `<button class="btn btn-warning" onclick="(function(e){ e.stopPropagation(); showEpisodeSettings(${item.id}); })(event)" title="Ustawienia odcinków">
                            <i class="fas fa-cog"></i>
                        </button>` :
                mediaType === 'movie' ?
                    `<button class="btn btn-success" onclick="(function(e){ e.stopPropagation(); toggleMovieWatchStatus(${item.id}); })(event)" title="${item.watched ? 'Oznacz jako nieobejrzany' : 'Oznacz jako obejrzany'}">
                            <i class="fas ${item.watched ? 'fa-eye-slash' : 'fa-eye'}"></i>
                        </button>` : ''
            }
                        <button class="btn btn-secondary" onclick="(function(e){ e.stopPropagation(); showDetails(${item.id}, '${mediaType}'); })(event)" title="Szczegóły">
                            <i class="fas fa-info-circle"></i>
                        </button>` :
            `<button class="btn btn-primary" onclick="(function(e){ e.stopPropagation(); addToWatchlist(${item.id}, '${mediaType}'); })(event)" title="${isInWatchlist ? 'W watchliście' : 'Dodaj do watchlisty'}">
                            <i class="fas fa-plus"></i>
                        </button>
                        <button class="btn btn-secondary" onclick="(function(e){ e.stopPropagation(); showDetails(${item.id}, '${mediaType}'); })(event)" title="Szczegóły">
                            <i class="fas fa-info-circle"></i>
                        </button>`
        }
                </div>
            </div>
        </div>
                    `;
}

async function addToWatchlist(id, mediaType) {
    try {
        const item = await getMediaDetails(id, mediaType);

        if (watchlist.some(w => w.id === id && w.media_type === mediaType)) {
            showToast('Element już znajduje się w watchliście', 'error');
            return;
        }

        if (mediaType === 'tv') {
            const tvDetails = await getTVDetails(id);
            item.number_of_seasons = tvDetails.number_of_seasons;
            item.number_of_episodes = tvDetails.number_of_episodes;
            item.last_air_date = tvDetails.last_air_date;
            item.next_episode_to_air = tvDetails.next_episode_to_air;
            item.last_episode_to_air = tvDetails.last_episode_to_air;
            item.status = tvDetails.status;
            item.seasons = tvDetails.seasons;
        } else if (mediaType === 'movie') {
            item.watched = false;
            item.watch_date = null;
        }

        item.media_type = mediaType;
        item.added_date = new Date().toISOString();

        watchlist.push(item);
        localStorage.setItem('watchlist', JSON.stringify(watchlist));

        loadWatchlist();
        showToast('Dodano do watchlisty!', 'success');
    } catch (error) {
        console.error('Błąd dodawania do watchlisty:', error);
        showToast('Błąd podczas dodawania', 'error');
    }
}

function toggleMovieWatchStatus(movieId) {
    const movieIndex = watchlist.findIndex(item => item.id === movieId && item.media_type === 'movie');
    if (movieIndex === -1) return;

    const movie = watchlist[movieIndex];
    movie.watched = !movie.watched;
    movie.watch_date = movie.watched ? new Date().toISOString() : null;

    localStorage.setItem('watchlist', JSON.stringify(watchlist));
    loadWatchlist();

    const statusText = movie.watched ? 'obejrzany' : 'nieobejrzany';
    showToast(`Film oznaczony jako ${statusText}`, 'success');
}

function removeFromWatchlist(id, mediaType, title) {
    const namePart = title ? ` "${title}"` : '';
    const typeWord = mediaType === 'tv' ? 'serial' : 'film';
    const confirmMessage = `Czy na pewno chcesz usunąć${namePart} (${typeWord}) z watchlisty?`;
    if (!confirm(confirmMessage)) {
        return;
    }

    watchlist = watchlist.filter(item => !(item.id === id && item.media_type === mediaType));
    localStorage.setItem('watchlist', JSON.stringify(watchlist));
    loadWatchlist();
    showToast('Usunięto z watchlisty', 'success');
}

function loadWatchlist() {
    updateWatchlistCount();

    if (watchlist.length === 0) {
        watchlistGrid.innerHTML = `
                    <div class="empty-watchlist">
                <i class="far fa-bookmark"></i>
                <p>Twoja watchlista jest pusta</p>
                <p>Użyj wyszukiwarki powyżej, aby dodać filmy i seriale</p>
            </div>
                    `;
        return;
    }

    watchlistGrid.innerHTML = watchlist.map(item => createMediaCard(item, true)).join('');
}

function updateWatchlistCount() {
    const count = watchlist.length;
    watchlistCount.textContent = `${count} ${count === 1 ? 'pozycja' : count < 5 ? 'pozycje' : 'pozycji'} `;
}



function escapeStringForOnclick(str) {
    if (!str) return '';
    return String(str).replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

function getTodayDateString() {
    const d = new Date();
    return d.toISOString().split('T')[0];
}

async function refreshWatchlistData() {
    if (!watchlist || watchlist.length === 0) return;

    showToast('Aktualizuję dane watchlisty...', 'success');

    for (let i = 0; i < watchlist.length; i++) {
        const item = watchlist[i];
        try {
            if (item.media_type === 'tv') {
                const details = await getTVDetails(item.id);
                item.last_episode_to_air = details.last_episode_to_air || item.last_episode_to_air;
                item.next_episode_to_air = details.next_episode_to_air || item.next_episode_to_air;
                item.status = details.status || item.status;
                item.seasons = details.seasons || item.seasons;
                item.name = details.name || item.name;
                item.poster_path = details.poster_path || item.poster_path;
            } else {
                const details = await getMediaDetails(item.id, 'movie');
                item.release_date = details.release_date || item.release_date;
                item.runtime = details.runtime || item.runtime;
                item.title = details.title || item.title;
                item.poster_path = details.poster_path || item.poster_path;
            }
        } catch (err) {
            console.error('Błąd odświeżania pozycji watchlisty:', item, err);
        }
    }

    localStorage.setItem('watchlist', JSON.stringify(watchlist));
    showToast('Dane watchlisty zaktualizowane', 'success');
}

async function checkAndRefreshWatchlist() {
    try {
        const last = localStorage.getItem('watchlistLastRefresh');
        const today = getTodayDateString();
        if (last === today) return;


        if (!watchlist || watchlist.length === 0) {
            localStorage.setItem('watchlistLastRefresh', today);
            return;
        }

        await refreshWatchlistData();
        localStorage.setItem('watchlistLastRefresh', today);
    } catch (err) {
        console.error('checkAndRefreshWatchlist error:', err);
    }
}

document.addEventListener('DOMContentLoaded', async function () {
    await checkAndRefreshWatchlist();
    loadWatchlist();
    setupEventListeners();

    settingsModal.addEventListener('click', function (e) {
        if (e.target === settingsModal) {
            closeEpisodeSettings();
        }
    });
});


async function showDetails(id, mediaType) {
    try {
        const details = await getMediaDetails(id, mediaType);

        let additionalInfo = '';
        if (mediaType === 'tv') {
            const tvDetails = await getTVDetails(id);
            const creators = tvDetails.created_by && tvDetails.created_by.length > 0
                ? tvDetails.created_by.map(c => c.name).join(', ')
                : '<span class="episode-info-text">Brak informacji</span>';

            additionalInfo = `
                    <div class="detail-info">
                    <p><strong>Liczba sezonów:</strong> ${tvDetails.number_of_seasons}</p>
                    <p><strong>Liczba odcinków:</strong> ${tvDetails.number_of_episodes}</p>
                    <p><strong>Status:</strong> ${tvDetails.status}</p>
                    <p><strong>Twórcy:</strong> ${creators}</p>
                    ${tvDetails.next_episode_to_air ?
                    `<p><strong>Następny odcinek:</strong> ${formatEpisodeWithDate(tvDetails.next_episode_to_air.season_number, tvDetails.next_episode_to_air.episode_number, tvDetails.next_episode_to_air.air_date)}</p>` : ''
                }
                </div>
                    `;
        } else {
            additionalInfo = `
                    <div class="detail-info">
                    <p><strong>Czas trwania:</strong> ${details.runtime} min</p>
                    <p><strong>Budżet:</strong> ${details.budget ? '$' + details.budget.toLocaleString() : 'Nieznany'}</p>
                    <p><strong>Przychody:</strong> ${details.revenue ? '$' + details.revenue.toLocaleString() : 'Nieznane'}</p>
                </div>
                    `;
        }

        modalContent.innerHTML = `
                    <div class="modal-header">
                <h2>${details.title || details.name}</h2>
                <button class="modal-close-btn" onclick="closeModal()">
                    <i class="fas fa-times"></i>
                </button>
            </div>
            <div class="detail-main">
                <div class="detail-image ${!details.poster_path ? 'no-image' : ''}">
                    ${details.poster_path ?
                `<img src="${IMAGE_BASE_URL + details.poster_path}" alt="${details.title || details.name}" onerror="this.parentElement.classList.add('no-image'); this.style.display='none';">` :
                `<div class="detail-placeholder">
                            <i class="fas ${details.media_type === 'movie' || !details.media_type ? 'fa-film' : 'fa-tv'}"></i>
                            <span>Brak obrazu</span>
                        </div>`
            }
                </div>
                <div class="detail-info">
                    <p><strong>Data premiery:</strong> ${formatDate(details.release_date || details.first_air_date)}</p>
                    <p><strong>Ocena:</strong> ${details.vote_average}/10 (${details.vote_count} głosów)</p>
                    <p><strong>Gatunki:</strong> ${details.genres ? details.genres.map(g => g.name).join(', ') : 'Brak informacji'}</p>
                    ${additionalInfo}
                </div>
            </div>
            <div class="detail-body">
                <div class="detail-overview">
                    <h3>Opis</h3>
                    <p>${details.overview || 'Brak opisu'}</p>
                </div>
            </div>
                `;

        detailsModal.classList.remove('hidden');
    } catch (error) {
        console.error('Błąd ładowania szczegółów:', error);
        showToast('Błąd podczas ładowania szczegółów', 'error');
    }
}

function getLatestEpisodeInfo(item) {
    let episodeText = '';

    if (item.last_episode_to_air) {
        const lastEpisode = item.last_episode_to_air;
        episodeText += `<span class="episode-history"><i class="fas fa-history"></i> ${formatEpisodeWithDate(lastEpisode.season_number, lastEpisode.episode_number, lastEpisode.air_date)} </span>`;
    }

    if (item.next_episode_to_air) {
        const nextEpisode = item.next_episode_to_air;
        if (episodeText);
        episodeText += `<span class="episode-clock"><i class="fas fa-clock"></i> ${formatEpisodeWithDate(nextEpisode.season_number, nextEpisode.episode_number, nextEpisode.air_date)} </span>`;
    } else if (item.status && episodeText) {
        episodeText += `<span class="episode-info"><i class="fas fa-info-circle"></i> ${getStatusInPolish(item.status)}</span>`;
    }

    if (!episodeText) {
        episodeText = '<span class="episode-question"><i class="fas fa-question-circle"></i>Brak informacji o odcinkach</span>';
    }

    return episodeText;
}

function getStatusInPolish(status) {
    const statusTranslations = {
        'Returning Series': 'Powracający serial',
        'Ended': 'Zakończony',
        'Canceled': 'Anulowany',
        'In Production': 'W produkcji',
        'Planned': 'Planowany',
        'Pilot': 'Pilot',
        'Running': 'Emitowany'
    };
    return statusTranslations[status] || status;
}

function closeModal() {
    detailsModal.classList.add('hidden');
}

function showToast(message, type = 'success') {
    toast.textContent = message;
    toast.className = `toast ${type} `;
    toast.classList.remove('hidden');
    setTimeout(() => {
        toast.classList.add('hidden');
    }, 3000);
}

function formatDate(dateString) {
    if (!dateString) return 'Nieznana';
    const d = new Date(dateString);
    if (isNaN(d)) return 'Nieznana';
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    return `${day}.${month}.${year}`;
}

function formatEpisode(season, episode) {
    return `S${season}E${episode} `;
}

function formatEpisodeWithDate(season, episode, date) {
    return `${formatEpisode(season, episode)} - ${formatDate(date)} `;
}

function generateSelectOption(value, text, isSelected = false) {
    return `<option value="${value}"${isSelected ? ' selected' : ''}>${text}</option>`;
}

function generateMissedEpisodesHtml(missedData) {
    const episodesList = missedData.episodes.map(ep =>
        `<div class="missed-episode-item"> ${ep.display}</div> `
    ).join('');

    return `
                    <div class="episode-missed-info">
            <h5><i class="fas fa-exclamation-triangle"></i> Nieobejrzane wyemitowane odcinki</h5>
            <p>Masz <strong>${missedData.count}</strong> nieobejrzanych odcinków:</p>
            <div class="episode-missed-list">
                ${episodesList}
            </div>
        </div> `;
}

function calculateMissedEpisodes(tvShow, seasonData = null) {
    if (!tvShow.last_episode_to_air) {
        return { count: 0, episodes: [] };
    }

    if (!tvShow.lastViewedSeason || !tvShow.lastViewedEpisode) {
        return { count: 0, episodes: [] };
    }

    const lastViewed = {
        season: parseInt(tvShow.lastViewedSeason),
        episode: parseInt(tvShow.lastViewedEpisode)
    };

    const lastAired = {
        season: tvShow.last_episode_to_air.season_number,
        episode: tvShow.last_episode_to_air.episode_number
    };

    const missedEpisodes = [];

    if (lastViewed.season === lastAired.season) {
        for (let ep = lastViewed.episode + 1; ep <= lastAired.episode; ep++) {
            missedEpisodes.push({
                season: lastViewed.season,
                episode: ep,
                display: formatEpisode(lastViewed.season, ep)
            });
        }
    } else if (lastViewed.season < lastAired.season) {
        if (lastAired.season - lastViewed.season === 1) {
            let maxEpisodesInViewedSeason = 20;

            if (seasonData) {
                const viewedSeasonInfo = seasonData.find(s => s.season_number === lastViewed.season);
                if (viewedSeasonInfo) {
                    maxEpisodesInViewedSeason = viewedSeasonInfo.episode_count;
                }
            }

            for (let ep = lastViewed.episode + 1; ep <= maxEpisodesInViewedSeason; ep++) {
                missedEpisodes.push({
                    season: lastViewed.season,
                    episode: ep,
                    display: formatEpisode(lastViewed.season, ep)
                });
            }

            for (let ep = 1; ep <= lastAired.episode; ep++) {
                missedEpisodes.push({
                    season: lastAired.season,
                    episode: ep,
                    display: formatEpisode(lastAired.season, ep)
                });
            }
        } else {
            let totalMissedCount = 0;

            if (seasonData) {
                const viewedSeasonInfo = seasonData.find(s => s.season_number === lastViewed.season);
                if (viewedSeasonInfo) {
                    totalMissedCount += viewedSeasonInfo.episode_count - lastViewed.episode;
                } else {
                    totalMissedCount += 6 - lastViewed.episode;
                }
            } else {
                totalMissedCount += 6 - lastViewed.episode;
            }

            for (let season = lastViewed.season + 1; season < lastAired.season; season++) {
                if (seasonData) {
                    const seasonInfo = seasonData.find(s => s.season_number === season);
                    if (seasonInfo) {
                        totalMissedCount += seasonInfo.episode_count;
                    } else {
                        totalMissedCount += 6;
                    }
                } else {
                    totalMissedCount += 6;
                }
            }
            totalMissedCount += lastAired.episode;

            missedEpisodes.push({
                season: 0,
                episode: 0,
                display: `Sezon ${lastViewed.season + 1} - ${lastAired.season} (około ${totalMissedCount} odcinków)`
            });

            return {
                count: totalMissedCount,
                episodes: missedEpisodes
            };
        }
    }

    return {
        count: missedEpisodes.length,
        episodes: missedEpisodes
    };
}

async function showEpisodeSettings(tvShowId) {
    const tvShow = watchlist.find(item => item.id === tvShowId && item.media_type === 'tv');
    if (!tvShow) return;

    currentTVShow = tvShow;

    try {
        const response = await fetch(`/api/tmdb?action=tv&id=${tvShowId}`);
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        const details = await response.json();

        window.currentTVDetails = details;

        const currentSeason = tvShow.lastViewedSeason || 1;
        const currentEpisode = tvShow.lastViewedEpisode || 1;

        const seasonOptions = [];
        const actualSeasons = details.seasons.filter(season => season.season_number > 0);

        for (const season of actualSeasons) {
            const selected = season.season_number == currentSeason;

            let displayEpisodeCount = season.episode_count;
            if (tvShow.last_episode_to_air) {
                const lastAiredSeason = tvShow.last_episode_to_air.season_number;
                const lastAiredEpisode = tvShow.last_episode_to_air.episode_number;

                if (season.season_number === lastAiredSeason) {
                    displayEpisodeCount = lastAiredEpisode;
                } else if (season.season_number > lastAiredSeason) {
                    displayEpisodeCount = 0;
                }
            }

            seasonOptions.push(generateSelectOption(season.season_number, `Sezon ${season.season_number} (${displayEpisodeCount} odcinków)`, selected));
        }

        const currentSeasonData = details.seasons.find(s => s.season_number == currentSeason);
        const maxEpisodes = currentSeasonData ? currentSeasonData.episode_count : 20;

        let maxAvailableEpisode = maxEpisodes;
        if (tvShow.last_episode_to_air) {
            const lastAiredSeason = tvShow.last_episode_to_air.season_number;
            const lastAiredEpisode = tvShow.last_episode_to_air.episode_number;

            if (currentSeason === lastAiredSeason) {
                maxAvailableEpisode = Math.min(maxEpisodes, lastAiredEpisode);
            } else if (currentSeason > lastAiredSeason) {
                maxAvailableEpisode = 0;
            }
        }

        const episodeOptions = [];

        let seasonEpisodes = [];
        try {
            const seasonDetails = await getTVSeasonDetails(tvShowId, currentSeason);
            seasonEpisodes = seasonDetails.episodes || [];
        } catch (error) {
            console.error('Error fetching season details:', error);
        }

        for (let i = 1; i <= maxAvailableEpisode; i++) {
            const episode = seasonEpisodes.find(ep => ep.episode_number === i);
            const episodeDate = episode && episode.air_date ? ` (${formatDate(episode.air_date)
                })` : '';
            episodeOptions.push(generateSelectOption(i, `Odcinek ${i}${episodeDate} `, i == currentEpisode));
        }

        const missedData = calculateMissedEpisodes(tvShow, details.seasons);
        let missedEpisodesHtml = '';

        if (missedData.count > 0) {
            missedEpisodesHtml = generateMissedEpisodesHtml(missedData);
        }

        settingsModalContent.innerHTML = `
                <div class="modal-header">
                    <h2>${tvShow.name}</h2>
                    <button class="modal-close-btn" onclick="closeEpisodeSettings()">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                <div class="modal-body">
                    <div class="episode-current-progress">
                        <h4><i class="fas fa-tv"></i> ${tvShow.name}</h4>
                        <p><strong>Liczba sezonów:</strong> ${actualSeasons.length}</p>
                        <p><strong>Ostatni wyemitowany:</strong> ${tvShow.last_episode_to_air ?
                formatEpisodeWithDate(tvShow.last_episode_to_air.season_number, tvShow.last_episode_to_air.episode_number, tvShow.last_episode_to_air.air_date) :
                'Brak informacji'}</p>
                        <p><strong>Następny odcinek:</strong> ${tvShow.next_episode_to_air ?
                formatEpisodeWithDate(tvShow.next_episode_to_air.season_number, tvShow.next_episode_to_air.episode_number, tvShow.next_episode_to_air.air_date) :
                'Brak planowanych'}</p>
                    </div>

                    <div class="episode-form-row">
                        <div class="episode-form-group">
                            <label for="seasonSelect">Ostatni obejrzany sezon:</label>
                            <select id="seasonSelect" onchange="handleSeasonChange()">
                                ${seasonOptions.join('')}
                            </select>
                        </div>

                        <div class="episode-form-group">
                            <label for="episodeSelect">Ostatni obejrzany odcinek:</label>
                            <select id="episodeSelect" onchange="updateMissedEpisodesWarning()">
                                ${episodeOptions.join('')}
                            </select>
                        </div>
                    </div>

                    ${missedEpisodesHtml}

                    <div class="episode-actions">
                        <button class="btn-cancel" onclick="closeEpisodeSettings()">Anuluj</button>
                        <button class="btn-save" onclick="saveEpisodeProgress()">Zapisz</button>
                    </div>
                </div>
                `;

        settingsModal.classList.remove('hidden');
    } catch (error) {
        console.error('Błąd ładowania ustawień odcinków:', error);
        console.error('TV Show ID:', tvShowId);
        console.error('TV Show data:', tvShow);
        showToast(`Błąd podczas ładowania ustawień: ${error.message}`, 'error');
    }
}

async function handleSeasonChange() {
    await updateEpisodeOptions();
}

async function updateEpisodeOptions() {
    const seasonSelect = document.getElementById('seasonSelect');
    const episodeSelect = document.getElementById('episodeSelect');
    const currentValue = episodeSelect.value;
    const selectedSeason = parseInt(seasonSelect.value);

    if (!window.currentTVDetails || !window.currentTVDetails.seasons) {
        console.error('No season data available');
        return;
    }

    const seasonData = window.currentTVDetails.seasons.find(s => s.season_number === selectedSeason);
    const maxEpisodes = seasonData ? seasonData.episode_count : 20;

    let maxAvailableEpisode = maxEpisodes;
    if (currentTVShow && currentTVShow.last_episode_to_air) {
        const lastAiredSeason = currentTVShow.last_episode_to_air.season_number;
        const lastAiredEpisode = currentTVShow.last_episode_to_air.episode_number;

        if (selectedSeason === lastAiredSeason) {
            maxAvailableEpisode = Math.min(maxEpisodes, lastAiredEpisode);
        } else if (selectedSeason > lastAiredSeason) {
            maxAvailableEpisode = 0;
        }
    }

    const episodeOptions = [];
    let seasonEpisodes = [];
    try {
        const seasonResponse = await fetch(`/api/tmdb?action=tv&id=${currentTVShow.id}&season=${selectedSeason}`);
        if (!seasonResponse.ok) {
            throw new Error(`HTTP ${seasonResponse.status}: ${seasonResponse.statusText}`);
        }
        const seasonDetails = await seasonResponse.json();
        seasonEpisodes = seasonDetails.episodes || [];
    } catch (error) {
        console.error('Error fetching season details:', error);
        console.error('TV Show ID:', currentTVShow.id, 'Season:', selectedSeason);
    }

    for (let i = 1; i <= maxAvailableEpisode; i++) {
        const episode = seasonEpisodes.find(ep => ep.episode_number === i);
        const episodeDate = episode && episode.air_date ? ` (${formatDate(episode.air_date)
            })` : '';
        episodeOptions.push(generateSelectOption(i, `Odcinek ${i}${episodeDate} `, i == currentValue));
    }

    episodeSelect.innerHTML = episodeOptions.join('');

    updateMissedEpisodesWarning();
}

function updateMissedEpisodesWarning() {
    if (!currentTVShow) return;

    const seasonSelect = document.getElementById('seasonSelect');
    const episodeSelect = document.getElementById('episodeSelect');

    const tempTVShow = {
        ...currentTVShow,
        lastViewedSeason: parseInt(seasonSelect.value),
        lastViewedEpisode: parseInt(episodeSelect.value)
    };

    const missedData = calculateMissedEpisodes(tempTVShow, window.currentTVDetails?.seasons);

    let missedDiv = document.querySelector('.episode-missed-info');

    if (missedData.count > 0) {
        const missedEpisodesHtml = generateMissedEpisodesHtml(missedData);

        if (missedDiv) {
            missedDiv.outerHTML = missedEpisodesHtml;
        } else {
            const progressDiv = document.querySelector('.episode-current-progress');
            if (progressDiv) {
                progressDiv.insertAdjacentHTML('afterend', missedEpisodesHtml);
            }
        }
    } else {
        if (missedDiv) {
            missedDiv.remove();
        }
    }
} function saveEpisodeProgress() {
    if (!currentTVShow) return;

    const seasonSelect = document.getElementById('seasonSelect');
    const episodeSelect = document.getElementById('episodeSelect');

    const season = seasonSelect.value;
    const episode = episodeSelect.value;

    const tvShowIndex = watchlist.findIndex(item => item.id === currentTVShow.id && item.media_type === 'tv');
    if (tvShowIndex !== -1) {
        watchlist[tvShowIndex].lastViewedSeason = parseInt(season);
        watchlist[tvShowIndex].lastViewedEpisode = parseInt(episode);
        localStorage.setItem('watchlist', JSON.stringify(watchlist));
        loadWatchlist();
        showToast('Postęp został zapisany!', 'success');
        closeEpisodeSettings();
    }
}

function closeEpisodeSettings() {
    settingsModal.classList.add('hidden');
    currentTVShow = null;
    if (window.currentTVDetails) {
        delete window.currentTVDetails;
    }
}
