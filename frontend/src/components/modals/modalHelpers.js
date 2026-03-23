export function openModal(id) {
  document.getElementById(id).classList.add('open');
  document.body.style.overflow = 'hidden';
}

export function closeModal(id) {
  document.getElementById(id).classList.remove('open');
  document.body.style.overflow = '';
}

export function closeModalOnOverlay(e, id) {
  if (e.target === document.getElementById(id)) closeModal(id);
}
