#!/bin/bash
set -e

# Usage: ./create-ova.sh <image_name_without_extension> [buffer_size_in_GB]
# Example: ./create-ova.sh ubuntu-ssd 2

IMAGE_NAME="$1"
BUFFER_GB="$2"

if [ -z "$IMAGE_NAME" ]; then
  echo "Usage: $0 <image_name_without_extension> [buffer_size_in_GB]"
  exit 1
fi

if [ ! -f "${IMAGE_NAME}.vmdk" ]; then
  echo "Error: ${IMAGE_NAME}.vmdk not found!"
  exit 1
fi

# Default buffer if not provided
if [ -z "$BUFFER_GB" ]; then
  BUFFER_GB=2
fi

# Get real VMDK size
VMDK_SIZE=$(stat -c%s "${IMAGE_NAME}.vmdk")
BUFFER_BYTES=$((BUFFER_GB * 1024 * 1024 * 1024))

# Calculate final capacity
DISK_CAPACITY=$((VMDK_SIZE + BUFFER_BYTES))

echo "Detected VMDK size: $VMDK_SIZE bytes (~$((VMDK_SIZE / 1024 / 1024 / 1024)) GiB)"
echo "Adding buffer: ${BUFFER_GB} GB"
echo "Final disk capacity for OVF: $DISK_CAPACITY bytes (~$((DISK_CAPACITY / 1024 / 1024 / 1024)) GiB)"

# Create OVF descriptor
cat >"${IMAGE_NAME}.ovf" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<ovf:Envelope
    xmlns:ovf="http://schemas.dmtf.org/ovf/envelope/1"
    xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
    xsi:schemaLocation="http://schemas.dmtf.org/ovf/envelope/1 ovf.xsd">

  <ovf:References>
    <ovf:File ovf:id="file1" ovf:href="${IMAGE_NAME}.vmdk" ovf:size="${VMDK_SIZE}"/>
  </ovf:References>

  <ovf:DiskSection>
    <ovf:Info>List of the virtual disks</ovf:Info>
    <ovf:Disk ovf:diskId="disk1" ovf:fileRef="file1" ovf:capacity="${DISK_CAPACITY}"/>
  </ovf:DiskSection>

  <ovf:VirtualSystem ovf:id="${IMAGE_NAME}">
    <ovf:Info>A virtual machine</ovf:Info>
    <ovf:Name>${IMAGE_NAME}</ovf:Name>

    <ovf:OperatingSystemSection ovf:id="94">
      <ovf:Info>The kind of installed guest operating system</ovf:Info>
      <ovf:Description>Ubuntu Linux (64-bit)</ovf:Description>
    </ovf:OperatingSystemSection>

    <ovf:VirtualHardwareSection>
      <ovf:Info>Virtual hardware requirements</ovf:Info>
    </ovf:VirtualHardwareSection>

  </ovf:VirtualSystem>

</ovf:Envelope>
EOF

echo "OVF descriptor created: ${IMAGE_NAME}.ovf"

# Create OVA archive
echo "Packing OVA..."
tar -cvf "${IMAGE_NAME}.ova" "${IMAGE_NAME}.ovf" "${IMAGE_NAME}.vmdk"

echo "OVA generation complete: ${IMAGE_NAME}.ova"
