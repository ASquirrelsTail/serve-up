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

export { post, patch }