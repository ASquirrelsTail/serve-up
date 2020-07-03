function request(endpoint, method, data) {
  return fetch(endpoint, {
      method: method,
      credentials: 'same-origin',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRFToken': document.querySelector('[name=csrfmiddlewaretoken]').value
      },
      body: JSON.stringify(data)
    })
}


function post(endpoint, data) {
  return request(endpoint, 'POST', data);
}

function patch(endpoint, data) {
  return request(endpoint, 'PATCH', data);
}

function del(endpoint) {
  return request(endpoint, 'Delete', {});
}

function toData(response) {
  if (response.status === 200) return response.json();
  else if (response.status === 403) window.location.replace('/admin/login/?next=/dashboard/');
}

export { post, patch, del, toData }