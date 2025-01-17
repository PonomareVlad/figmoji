import './ui.css'
import _ from "lodash";
import $ from "jquery";
import * as mixpanel from 'mixpanel-figma';
import { mixpanel_key } from '../keys.json';

let emojiUnicodeList = [];

$(document).ready(function () {
    // disabling via config just in case
    if (mixpanel_key) mixpanel.init(mixpanel_key, {
        disable_cookie: true,
        disable_persistence: true
    })
    parent.postMessage({
        pluginMessage: {
            type: 'check-mixpanel-user'
        }
    }, '*');
    fetchEmojiUnicodes();
});

// On clicking tabs
$(document).on("click","ul.tabs li", function(){
    const category = $(this).attr('data-tab');
    $('ul.tabs li').removeClass('current');
    $('.tab-content').removeClass('current');
    populateEmojis(emojiUnicodeList[category]);
    $(this).addClass('current');
    $('#emoji-container').scrollTop(0);
    if (mixpanel_key) mixpanel.track("Figmoji", {"Action": "Tab clicked: " + category});
});

// Adding shadow on scroll
$('#emoji-container').on('scroll', function() {
    if (!$('#emoji-container').scrollTop()) {
        $('.container').removeClass('shadow')
    } else {
        $('.container').addClass('shadow')
    }
})

// Listing all the Emojis from the unicode list onto the view
const populateEmojis = (list) => {
    let emojiUnicodes = '';
    for(let i=0; i<list.length; i++) {
        if(!emojiUnicodes.includes(list[i].char)) {
            emojiUnicodes += list[i].char;
        }
    }

    document.getElementById('emoji-container').textContent = emojiUnicodes;

    twemoji.parse(document.getElementById('emoji-container'), {
        folder: 'svg',
        ext: '.svg',
        size: 128
    });

    let imgs = document.getElementsByTagName("img");
    for (let i = 0; i < imgs.length; i++) {
        let src = imgs[i].src;
        let emoji = imgs[i].alt;
        imgs[i].onclick = function() {fetchImg(src, emoji)};
    }
}

/* Fetching the unicodelist from
 * https://github.com/amio/emoji.json
 */
const fetchEmojiUnicodes = () => {
    fetch("https://unpkg.com/emoji.json@12.1.0/emoji.json")
    .then(res => res.json())
    .then((emojiList) => {
        emojiUnicodeList = emojiList;
        emojiUnicodeList = _.groupBy(emojiList, (emoji) => {
            return emoji.category.substr(0, emoji.category.indexOf('(')).trim();
        });

        // Adding appropriate category tabs
        for (const key in emojiUnicodeList) {
            $('#tab-list').append('<li class="tab-link" data-tab="' + key +'">' + key + '</li>');
        }
        $('.tab-link').eq(0).click();

    })
    .catch(() => {
        console.log('There was an issue while fetching the emoji list');
        document.getElementById('emoji-container').setAttribute('style', 'display:none');
        document.getElementById('error').setAttribute('style', 'display:flex');
    });
}

// Asking figma to add selected emoji onto canvas
const postMessage = (source, type) => {
    console.debug('postMessage', {source, type})
    parent.postMessage({
        pluginMessage: {
            type: `insert-image-${type}`,
            source,
        }
    }, '*');
}

// Fetching svg code of selected Emoji
const fetchImg = (url, emoji) => {
    const isAppleEmoji = appleEmojiRequired()
    const targetURL = isAppleEmoji ? `https://applemoji.vercel.app/${getAppleImage(emoji)}.png` : url
    fetch(targetURL).then(r => r.arrayBuffer()).then(buff => {
        if (isAppleEmoji) return postMessage(new Uint8Array(buff), 'png')
        let blob = new Blob([new Uint8Array(buff)], {type: "image/svg"});
        const reader = new FileReader()
        reader.onload = () => postMessage(reader.result, 'svg');
        reader.readAsText(blob);
    });
}

const appleEmojiRequired = () => document.getElementById('apple-emoji') && document.getElementById('apple-emoji').checked

const getAppleImage = char => {
    console.debug('getAppleImage', char)
    const code = char.replace(/[\ufe00-\ufe0f\u200d]/g, '');
    const name = [];
    for (let i = 0; i < code.length; i++)
        name.push(('0000' + char.charCodeAt(i).toString(16)).slice(-4));
    return name.join('-')
}

// Function to recieve events from figma
onmessage = e => {
    if (!e.data) return;

    const data = e.data.pluginMessage.data;
    const type = e.data.pluginMessage.type;

    if (mixpanel_key) {
        if (type === 'USERID') {
            mixpanel.identify(data);
            mixpanel.track("Figmoji", {"Action": "Plugin Opened"});
        }
        if (type === 'INSERT_SUCCESSFUL') {
            mixpanel.track("Figmoji", {"Action": "Emoji Inserted"});
        }
    }
};
