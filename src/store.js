import { writable } from 'svelte/store';

export const group = writable(document.body.dataset.group);
export const csrfToken = document.querySelector('[name=csrfmiddlewaretoken]').value;
