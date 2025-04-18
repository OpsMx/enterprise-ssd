#!/bin/bash 
set -e


# This can be Release tag (recommended) or a branch name
RELEASETAG=ami_image_creation_v2

sudo apt update
sudo apt install -y unzip curl

# Download the latest Packer binary
PACKER_VERSION="1.11.1"
curl -fsSL -o packer.zip "https://releases.hashicorp.com/packer/${PACKER_VERSION}/packer_${PACKER_VERSION}_linux_amd64.zip"

# Unzip and move to /usr/local/bin
unzip packer.zip
sudo mv packer /usr/local/bin/
packer --version  # confirm install
packer plugins install github.com/hashicorp/qemu
sudo apt install -y qemu-system-x86 qemu-utils

curl -fSL -o ssd-ubuntu.pkr.hcl https://raw.githubusercontent.com/OpsMx/enterprise-ssd/refs/heads/ami_image_creation_v2/vm-install/packer/ssd-ubuntu.pkr.hcl

curl -fSL -o ssd-ubuntu.pkrvars.hcl https://raw.githubusercontent.com/OpsMx/enterprise-ssd/refs/heads/ami_image_creation_v2/vm-install/packer/ssd-ubuntu.pkrvars.hcl

IMG="jammy-server-cloudimg-amd64.img"
IMG_URL="https://cloud-images.ubuntu.com/jammy/current/$IMG"
CHECKSUM=$(curl -s https://cloud-images.ubuntu.com/jammy/current/SHA256SUMS | grep "$IMG" | awk '{print $1}')

# Inject checksum into a Packer HCL file template
envsubst <<EOF > ssd-ubuntu.pkrvars.hcl
iso_url = "$IMG_URL"
iso_checksum = "sha256:$CHECKSUM"
EOF

packer init .
packer build -var-file=ssd-ubuntu.pkrvars.hcl .

